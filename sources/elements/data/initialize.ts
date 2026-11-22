import Tokenizer from '../../tokenizer.ts'
import type Base from '../base.ts'
import DataElement, {getNumericKind} from '../dataElement.ts'
import Assign from '../assign.ts'
import ClassElement, {getClassPropertyAccess} from '../clasElement.ts'
import Call from '../call.ts'
import {getStringLiteralContents} from '../../stringLiteral.ts'
import {parseJSONParseInitializer,parseJSONStringifyInitializer,createJSONArrayLayout,getJSONValueFromProperties,getJSONValueFromData,isJSONObject,createJSONProperties,createJSONDataElement} from './json.ts'
import {createStructLayout,parseObjectLiteral} from './struct.ts'
import {nextCallResultId,nextStructLayoutId} from './ids.ts'
import type {JSONArrayLayout} from './types.ts'
import {initializeArray} from './arrayInitializer.ts'
import type Data from '../data.ts'

export function initializeData(data:Data,tokenizer:Tokenizer,classField=false){
    let tokens:string[] = []
    let objectDepth = 0
    while(tokenizer.has()){
        const token = tokenizer.get()
        if(token==='\n'){
            if(objectDepth===0){
                break
            }
            continue
        }
        if(token===';'&&objectDepth===0){
            break
        }
        tokens.push(token)
        if(token==='{'){
            objectDepth++
        }else if(token==='}'){
            objectDepth--
        }
    }
    if(!classField&&tokens[1]==='{'){
        data.setDestructure(tokens)
        return
    }
    let kind:string
    let name:string
    let type:string|undefined
    if(classField){
        kind = 'let'
        name = tokens[0]
        type = tokens[2]
    }else{
        kind = tokens[0]
        name = tokens[1]
        type = tokens[2]===':'?tokens[3]:undefined
    }
    type = type?.replace(/;$/,'')
    const initializerIndex = tokens.indexOf('=')
    const hasInitializer = initializerIndex!==-1
    const initializerTokens = hasInitializer?tokens.slice(initializerIndex+1):[]
    const eq = hasInitializer?'=':undefined
    const chainedMethodCall = initializerTokens.join('').match(/^([a-z_$][\w.$]*\([\s\S]*\))\.([a-z_$][\w$]*)\(\)$/i)
    const jsonParseValue = hasInitializer&&data.parent
        ? parseJSONParseInitializer(initializerTokens,data.parent)
        : undefined
    const jsonStringifyValue = hasInitializer&&data.parent
        ? parseJSONStringifyInitializer(initializerTokens,data.parent)
        : null
    if(jsonParseValue!==undefined&&type&&type!=='any'){
        throw new Error(`JSON.parse result cannot be assigned to "${type}"`)
    }
    if(jsonStringifyValue!==null&&type&&type!=='string'){
        throw new Error(`JSON.stringify result cannot be assigned to "${type}"`)
    }
    let value = initializerTokens[0]
    if(!hasInitializer&&(type==='Function'||type==='function')){
        value='0'
    }
    const asyncFunctionName = /^[a-z_$][\w$]*$/i.test(initializerTokens[0]??'')
        &&initializerTokens[1]==='('
        &&initializerTokens[initializerTokens.length-1]===')'
        ? initializerTokens[0]
        : null
    const isTimeoutInitializer = initializerTokens[0]==='setTimeout'
        &&initializerTokens[1]==='('
        &&initializerTokens[initializerTokens.length-1]===')'
    const isAsyncInitializer = Boolean(
        isTimeoutInitializer
        ||asyncFunctionName&&data.parent?.getFunction(asyncFunctionName)?.isAsync
    )
    if(type==='Task'&&hasInitializer&&!isAsyncInitializer){
        throw new Error(`Task "${name}" must be initialized with an async function call or setTimeout`)
    }
    if(!type&&isAsyncInitializer){
        type='Task'
    }
    if(type==='Task'){
        value='0'
    }
    let jsonParseClass:ClassElement|null = null
    let jsonRootArray:JSONArrayLayout|null = null
    if(jsonParseValue!==undefined&&data.parent){
        if(isJSONObject(jsonParseValue)){
            const properties = createJSONProperties(jsonParseValue,data.parent).map(createJSONDataElement)
            const className = `__ds_struct_${nextStructLayoutId()}`
            jsonParseClass = new ClassElement(className,properties,[])
            data.parent.addClass(jsonParseClass)
            type = className
        }else if(Array.isArray(jsonParseValue)){
            jsonRootArray = createJSONArrayLayout(jsonParseValue,data.parent)
            type = `${jsonRootArray.type}[]`
        }else if(typeof jsonParseValue==='string'){
            type = 'string'
            value = JSON.stringify(jsonParseValue).slice(1,-1)
        }else if(typeof jsonParseValue==='number'){
            if(!Number.isFinite(jsonParseValue)){
                throw new Error('JSON.parse result must contain finite numbers')
            }
            type = 'number'
            value = String(jsonParseValue)
        }else if(typeof jsonParseValue==='boolean'){
            type = 'boolean'
            value = jsonParseValue?'1':'0'
        }else{
            type = 'null'
            value = '0'
        }
    }else if(jsonStringifyValue!==null){
        type = 'string'
    }
    const arrayType = type?.match(/^([a-z_$][\w$]*)\[\]$/i)
    const arrayInitialization = initializeArray(data,name,tokens,initializerTokens,arrayType,jsonRootArray,value,eq)
    let arrayValues = arrayInitialization.arrayValues
    let arrayObjectValues = arrayInitialization.arrayObjectValues
    let inferredArrayClass = arrayInitialization.inferredArrayClass
    value = arrayInitialization.value
    let numericExpression:string|null = null
    let runtimeInitializer = false
    if(type==='boolean'){
        if(!hasInitializer){
            value = '0'
        }else{
            const expression = initializerTokens.join('')
            if(expression==='true'||expression==='false'){
                value = expression==='true'?'1':'0'
            }else{
                const source = data.parent?.getData(expression)
                const sourceAccess = data.parent?getClassPropertyAccess(data.parent,expression):null
                let isBooleanCall = false
                if(/^[a-z_$][\w.$]*\([\s\S]*\)$/i.test(expression)){
                    const callTokenizer = new Tokenizer(expression)
                    const call = new Call(data.parent!)
                    call.set(callTokenizer)
                    isBooleanCall = !callTokenizer.has()
                        &&Boolean(call.builtinStringSearchMethod&&call.builtinStringSearchMethod!=='indexOf')
                }
                if(source?.type==='boolean'&&!source.isArray
                    ||sourceAccess?.property.type==='boolean'&&!sourceAccess.property.isArray
                    ||isBooleanCall){
                    numericExpression = expression
                    runtimeInitializer = true
                    value = '0'
                }else{
                    throw new Error(`Boolean "${name}" must be initialized with true, false, another boolean, or a boolean-returning string method`)
                }
            }
        }
    }
    if(type==='number'&&eq==='='&&jsonParseValue===undefined&&jsonStringifyValue===null){
        numericExpression = initializerTokens.join('').replace(/;$/,'')
        runtimeInitializer = !/^[+-]?(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(numericExpression)
        if(runtimeInitializer){
            if(classField){
                throw new Error(`Numeric expression initializer is not supported for class field "${name}"`)
            }
            value = '0'
        }else{
            value = numericExpression
        }
    }
    const normalizedType = arrayType?inferredArrayClass?.name??arrayType[1]:type
    let classType = inferredArrayClass??jsonParseClass??(normalizedType?data.parent?.getClass(normalizedType):null)
    let classLayout:{type:string,props:DataElement[]}|null = jsonParseClass
        ? {type:jsonParseClass.name!,props:jsonParseClass.props}
        : null
    let classInitializerArgs:string[]|null = null
    if(classType&&!arrayType&&eq==='='&&!jsonParseClass){
        if(initializerTokens[0]==='{'){
            const properties = parseObjectLiteral(initializerTokens)
            classLayout = createStructLayout(properties,classType,name)
        }else if(initializerTokens[0]!=='new'||initializerTokens[1]!==normalizedType||initializerTokens[2]!=='('||initializerTokens[initializerTokens.length-1]!==')'){
            throw new Error(`Class instance "${name}" must be initialized with new ${normalizedType}()`)
        }else{
            const callTokenizer = new Tokenizer(initializerTokens.slice(2).join(' '))
            callTokenizer.get()
            classInitializerArgs = callTokenizer.getCallArguments()
            if(callTokenizer.has()){
                throw new Error(`Invalid constructor initializer for class instance "${name}"`)
            }
        }
    }else if(!type&&eq==='='&&initializerTokens[0]==='{'){
        const properties = parseObjectLiteral(initializerTokens)
        classLayout = createStructLayout(properties,null,name)
        classType = new ClassElement(classLayout.type,classLayout.props,[])
        data.parent?.addClass(classType)
        type = classLayout.type
    }
    let values = [value]
    if(type=='string'){
        if(chainedMethodCall){
            value = '0'
        }
        values = chainedMethodCall?['0']: [jsonParseValue!==undefined
            ? JSON.stringify(jsonParseValue).slice(1,-1)
            : jsonStringifyValue!==null
                ? JSON.stringify(jsonStringifyValue).slice(1,-1)
                : hasInitializer?getStringLiteralContents(initializerTokens.join('')):'']
    }
    data.element = new DataElement(kind,name,arrayType?classType?.name??arrayType[1]:type??'',arrayType?value:values.join(' ')??'')
    if(jsonParseValue!==undefined){
        data.element.jsonValue = jsonParseValue
    }else if(jsonStringifyValue!==null){
        data.element.jsonValue = jsonStringifyValue
    }else if(classLayout&&data.parent){
        data.element.jsonValue = getJSONValueFromProperties(classLayout.props,data.parent)
    }else if(data.parent){
        data.element.jsonValue = getJSONValueFromData(data.element,data.parent)
    }
    if(chainedMethodCall&&type==='string'&&data.parent){
        const [,callExpression,methodName] = chainedMethodCall
        const callTokenizer = new Tokenizer(callExpression)
        const initializerCall = new Call(data.parent)
        initializerCall.set(callTokenizer)
        if(callTokenizer.has()){
            throw new Error('Invalid function call in chained method initializer')
        }
        const className = initializerCall.func?.returnClassType
            ??(initializerCall.func?.returnType?data.parent.getClass(initializerCall.func.returnType)?.name:null)
        const classType = className?data.parent.getClass(className):null
        const method = classType?.getFunction(methodName)
        if(!className||!method){
            throw new Error(`Unable to resolve method "${methodName}" on returned class`)
        }
        if(method.params.length||method.returnType!=='string'){
            throw new Error(`Chained method "${methodName}" must take no arguments and return a string`)
        }
        let temporaryName = ''
        do{
            temporaryName = `__ds_call_result_${nextCallResultId()}`
        }while(data.parent.getData(temporaryName))
        const temporary = new DataElement('let',temporaryName,className,'0')
        temporary.classType = className
        temporary.isReferenceAlias = true
        temporary.isHeapAllocated = true
        let functionScope:Base|null = data.parent
        while(functionScope&&!functionScope.isFunctionScope){
            functionScope = functionScope.parent
        }
        temporary.isProcedureLocal = Boolean(functionScope)
        data.parent.addData(temporary)
        initializerCall.resultTarget = temporary
        const methodCall = new Call(data.parent)
        methodCall.set(new Tokenizer(`${temporaryName}.${methodName}()`))
        methodCall.resultTarget = data.element
        data.initializerTemps.push(temporary)
        data.initializerCalls.push(initializerCall,methodCall)
        data.runtimeCallInitializer = true
    }
    if(classLayout){
        data.element.classLayoutType = classLayout.type
        data.element.classLayoutProps = classLayout.props
    }
    if(arrayType){
        data.element.isArray = true
        data.element.dynamicArray = arrayValues.length===0
        data.element.arrayObjectValues = arrayObjectValues
        data.element.numericKind = data.arrayInitializerCall?.func?.returnArrayNumericKind
            ??(arrayType[1]==='number'&&arrayValues.some(item=>getNumericKind(item)==='float')?'float':'integer')
        if(classType){
            data.element.classType = classType.name
        }
    }
    if(!arrayType){
        data.element.classType = classType?.name??null
    }
    data.element.isConstAlias = kind==='const'
        &&type==='number'
        &&!arrayType
        &&!classType
        &&!runtimeInitializer
        &&/^[+-]?(?:0x[0-9a-f]+|[0-9a-f]+h|\d+)$/i.test(value??'')
    data.element.isExportedConstAlias = data.element.isConstAlias
        &&Boolean(data.parent?.EXPORT[name])
    data.parent?.addData(data.element)
    if(!classField&&classInitializerArgs&&data.parent&&classType){
        const constructor = classType.getFunction('constructor')
        if(constructor){
            if(classInitializerArgs.length!==constructor.params.length){
                throw new Error(`Constructor for "${classType.name}" expects ${constructor.params.length} arguments, received ${classInitializerArgs.length}`)
            }
            data.initializerCall = new Call(data.parent)
            data.initializerCall.set(new Tokenizer(`${data.element.name}.constructor(${classInitializerArgs.join(',')})`))
        }else if(classInitializerArgs.length){
            throw new Error(`Class "${classType.name}" has no constructor`)
        }
    }
    if(runtimeInitializer&&numericExpression&&data.parent){
        const initializer = new Assign(data.parent)
        initializer.setExpression(data.element,numericExpression,true)
        data.parent.children.push(initializer)
    }
    if(isAsyncInitializer&&data.parent){
        const initializer = new Assign(data.parent)
        initializer.setTask(data.element,initializerTokens.join(''))
        data.parent.children.push(initializer)
    }
}
