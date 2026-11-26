import Tokenizer from '../../tokenizer.ts'
import {parseRegExpLiteral} from '../../regex.ts'
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
import {getTypedArrayKind,initializeTypedArray,sliceTypedArray} from './typedArrays.ts'
import type Data from '../data.ts'
import {getPromiseValueTypeFromData,parsePromiseInitializer} from '../promise.ts'
import TypePrototypeRegistry from '../typePrototype.ts'

function initializeObjectAssign(active:Base,tokens:string[],name:string){
    const text = tokens.join('')
    if(!text.startsWith('Object.assign(')){
        return null
    }
    const tokenizer = new Tokenizer(text)
    if(tokenizer.get()!=='Object.assign'||tokenizer.get()!=='('){
        throw new Error('Invalid Object.assign initializer')
    }
    const args = tokenizer.getCallArguments()
    if(tokenizer.has()||args.length<2||args[0]!=='{}'){
        throw new Error('Object.assign initializer must use an empty object target and at least one source')
    }
    const sources = args.slice(1).map(argument=>{
        const sourceName = argument
        if(!/^[a-z_$][\w$]*$/i.test(sourceName)){
            throw new Error('Object.assign sources must be struct identifiers')
        }
        const source = active.getData(sourceName)
        const classType = source?.classType?active.getClass(source.classType):null
        const properties = source?.classLayoutProps??classType?.props
        if(!source||source.isArray||!properties){
            throw new Error(`Object.assign expects a struct source, received "${sourceName}"`)
        }
        if(properties.some(property=>property.isArray||property.classType
            ||!['number','string','boolean'].includes(property.type??''))){
            throw new Error(`Object.assign source "${sourceName}" contains an unsupported property`)
        }
        return {source,properties}
    })
    const mergedProperties:DataElement[] = []
    for(const {properties} of sources){
        for(const property of properties){
            const existing = mergedProperties.findIndex(value=>value.name===property.name)
            const copy = new DataElement('let',property.name??'',property.type??'',property.value??'0')
            copy.numericKind = property.numericKind
            if(existing===-1){
                mergedProperties.push(copy)
            }else{
                mergedProperties[existing] = copy
            }
        }
    }
    if(!mergedProperties.length){
        throw new Error(`Cannot infer struct type for Object.assign initializer "${name}"`)
    }
    const type = `__ds_struct_${nextStructLayoutId()}`
    const classType = new ClassElement(type,mergedProperties,[])
    active.addClass(classType)
    return {
        type,
        classType,
        properties:mergedProperties,
        sources:sources.map(({source})=>source)
    }
}

export function initializeData(data:Data,tokenizer:Tokenizer,classField=false){
    let tokens:string[] = []
    let objectDepth = 0
    let arrayDepth = 0
    let quote:string|null = null
    let timeoutCallbackDepth = 0
    let timeoutCall = false
    let timeoutCallbackPending = false
    while(tokenizer.has()){
        const token = tokenizer.get()
        if(token==='\n'){
            if(objectDepth===0&&arrayDepth===0){
                break
            }
            if(timeoutCallbackDepth===0){
                continue
            }
        }
        if(token===';'&&objectDepth===0){
            break
        }
        tokens.push(token)
        if(quote){
            if(token===quote){
                quote = null
            }
        }else if(token==="'"||token==='"'){
            quote = token
        }else if(!parseRegExpLiteral(token)){
            for(const char of token){
                if(char==='['){
                    arrayDepth++
                }else if(char===']'){
                    arrayDepth--
                }
            }
        }
        if(token==='{'){
            objectDepth++
            if(timeoutCallbackPending){
                timeoutCallbackDepth = 1
                timeoutCallbackPending = false
            }else if(timeoutCallbackDepth>0){
                timeoutCallbackDepth++
            }
        }else if(token==='}'){
            objectDepth--
            if(timeoutCallbackDepth>0){
                timeoutCallbackDepth--
            }
        }else if(token==='setTimeout'){
            timeoutCall = true
        }else if(token==='=>'&&timeoutCall){
            timeoutCallbackPending = true
        }
    }
    if(!classField&&tokens[1]==='{'){
        data.setDestructure(tokens)
        return
    }
    if(!classField&&tokens[1]?.startsWith('[')){
        data.setArrayDestructure(tokens)
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
    const declaredType = type&&TypePrototypeRegistry.hasType(type.replace(/\[\]$/,''))
        ? type.replace(/\[\]$/,'')
        : null
    const resolvedType = type?TypePrototypeRegistry.resolveType(type):null
    if(resolvedType){
        type = resolvedType.isArray?`${resolvedType.type}[]`:resolvedType.type
    }
    const initializerIndex = tokens.indexOf('=')
    const hasInitializer = initializerIndex!==-1
    const initializerTokens = hasInitializer?tokens.slice(initializerIndex+1):[]
    if(!type&&initializerTokens[0]==='new'&&initializerTokens[1]){
        type = data.parent?.getClass(initializerTokens[1])?.name??undefined
    }
    let returnedValueCall:Call|null = null
    const initializerCallExpression = initializerTokens.join('')
    if(data.parent&&/^[a-z_$][\w.$]*\([\s\S]*\)$/i.test(initializerCallExpression)){
        const callTokenizer = new Tokenizer(initializerCallExpression)
        const call = new Call(data.parent)
        call.set(callTokenizer)
        if(!callTokenizer.has()&&call.func&&!call.func.isAsync){
            returnedValueCall = call
            type ??= call.func.returnType??call.func.returnClassType??undefined
        }
    }
    const eq = hasInitializer?'=':undefined
    const promiseInitializerExpression = initializerTokens.join('')
    const hasPromiseInitializer = /^Promise\.(?:resolve|reject|all)\(/.test(promiseInitializerExpression)
        ||promiseInitializerExpression.startsWith('newPromise(')
    const hasAwaitInitializer = initializerTokens[0]==='await'
    if(hasAwaitInitializer){
        if(initializerTokens.length!==2){
            throw new Error('Await initializer must contain one Promise variable')
        }
        const promise = data.parent?.getData(initializerTokens[1])
        const promiseType = promise?getPromiseValueTypeFromData(promise):null
        if(!promise||!promiseType){
            throw new Error('Await expects a Promise<T> variable')
        }
        if(type&&type!==promiseType){
            throw new Error(`Awaited Promise value type "${promiseType}" does not match "${type}"`)
        }
        type ??= promiseType
    }
    const chainedMethodCall = initializerTokens.join('').match(/^([a-z_$][\w.$]*\([\s\S]*\))\.([a-z_$][\w$]*)\(\)$/i)
    const jsonParseValue = hasInitializer&&data.parent
        ? parseJSONParseInitializer(initializerTokens,data.parent)
        : undefined
    const jsonStringifyValue = hasInitializer&&data.parent
        ? parseJSONStringifyInitializer(initializerTokens,data.parent)
        : null
    const arrayToStringCall = initializerTokens.join('').match(/^([a-z_$][\w$]*)\.toString\(\)$/i)
    const toStringReceiver = arrayToStringCall?data.parent?.getData(arrayToStringCall[1]):null
    const arrayToStringInitializer = arrayToStringCall&&toStringReceiver?.isArray?arrayToStringCall:null
    const arrayBufferToStringInitializer = arrayToStringCall&&toStringReceiver?.type==='ArrayBuffer'
        ? arrayToStringCall
        : null
    const toStringInitializer = arrayToStringInitializer??arrayBufferToStringInitializer
    if(jsonParseValue!==undefined&&type&&type!=='any'){
        throw new Error(`JSON.parse result cannot be assigned to "${type}"`)
    }
    if(jsonStringifyValue!==null&&type&&type!=='string'){
        throw new Error(`JSON.stringify result cannot be assigned to "${type}"`)
    }
    if(toStringInitializer&&type&&type!=='string'){
        throw new Error(`toString result cannot be assigned to "${type}"`)
    }
    if(toStringInitializer&&!type){
        type='string'
    }
    let value = hasAwaitInitializer?'0':initializerTokens[0]
    if(hasPromiseInitializer){
        if(classField){
            throw new Error('Promise class fields are not supported')
        }
        type ??= 'Promise'
        value = '0'
    }
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
    let typedArrayInitializer:ReturnType<typeof initializeTypedArray>|null = null
    const typedArrayCall = hasInitializer
        ? initializerTokens.join('').match(/^new([A-Za-z0-9_$]+)\(([\s\S]*)\)$/)
        : null
    const typedArraySliceCall = hasInitializer
        ? initializerTokens.join('').match(/^([a-z_$][\w$]*)\.slice\(([\s\S]*)\)$/i)
        : null
    const typedArraySliceSource = typedArraySliceCall
        ? data.parent?.getData(typedArraySliceCall[1])
        : null
    const typedArrayKind = getTypedArrayKind(typedArrayCall?.[1]??type??typedArraySliceSource?.typedArrayKind)
    if(typedArrayKind){
        if(!typedArrayCall&&!typedArraySliceCall){
            throw new Error(`Typed array "${name}" must be initialized with a ${typedArrayKind} constructor`)
        }
        if(type&&type!==typedArrayKind){
            throw new Error(`Typed array "${name}" is declared as "${type}" but initialized as "${typedArrayCall?.[1]??typedArraySliceSource?.typedArrayKind}"`)
        }
        const callTokenizer = new Tokenizer(`(${typedArrayCall?.[2]??typedArraySliceCall?.[2]??''})`)
        callTokenizer.get()
        const args = callTokenizer.getCallArguments()
        if(callTokenizer.has()){
            throw new Error(`Invalid ${typedArrayKind} ${typedArraySliceCall?'slice':'constructor'}`)
        }
        if(typedArraySliceCall){
            typedArrayInitializer = sliceTypedArray(data.parent!,typedArrayKind,typedArraySliceCall[1],args)
        }else{
            typedArrayInitializer = initializeTypedArray(data.parent!,typedArrayKind,args)
        }
        type = typedArrayInitializer.kind.startsWith('Big')?'bigint':'number'
        value = typedArrayInitializer.values.join(', ')
    }
    const arrayType = type?.match(/^([a-z_$][\w$]*)\[\]$/i)
    const arrayInitialization = initializeArray(data,name,tokens,initializerTokens,arrayType,jsonRootArray,value,eq)
    let arrayValues = arrayInitialization.arrayValues
    let arrayObjectValues = arrayInitialization.arrayObjectValues
    let inferredArrayClass = arrayInitialization.inferredArrayClass
    value = arrayInitialization.value
    const objectAssign = !classField&&!arrayType&&hasInitializer&&data.parent
        ? initializeObjectAssign(data.parent,initializerTokens,name)
        : null
    if(objectAssign){
        if(type){
            throw new Error('Object.assign initializer does not support an explicit type')
        }
        type = objectAssign.type
    }
    let numericExpression:string|null = null
    let runtimeInitializer = false
    if(hasAwaitInitializer){
        numericExpression = `await ${initializerTokens[1]}`
        runtimeInitializer = true
        value = '0'
    }
    if(type==='boolean'&&!hasAwaitInitializer){
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
                        &&Boolean(call.builtinStringSearchMethod&&call.builtinStringSearchMethod!=='indexOf'
                            ||call.func?.returnType==='boolean')
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
    if(type==='number'&&!hasAwaitInitializer&&eq==='='&&jsonParseValue===undefined&&jsonStringifyValue===null&&!typedArrayInitializer){
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
    let classReturnCall:Call|null = null
    if(objectAssign){
        classType = objectAssign.classType
        classLayout = {type:objectAssign.type,props:objectAssign.properties}
        data.objectAssignSources = objectAssign.sources
    }else if(classType&&!arrayType&&eq==='='&&!jsonParseClass&&!hasPromiseInitializer&&!hasAwaitInitializer){
        if(initializerTokens[0]==='{'){
            const properties = parseObjectLiteral(initializerTokens)
            classLayout = createStructLayout(properties,classType,name)
        }else if(returnedValueCall
            &&(returnedValueCall.func?.returnClassType===normalizedType
                ||returnedValueCall.func?.returnType===normalizedType)){
            classReturnCall = returnedValueCall
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
        if(chainedMethodCall||toStringInitializer){
            value = '0'
        }
        values = hasAwaitInitializer||chainedMethodCall||toStringInitializer
            ||returnedValueCall?.func?.returnType==='string'?['0']: [jsonParseValue!==undefined
            ? JSON.stringify(jsonParseValue).slice(1,-1)
            : jsonStringifyValue!==null
                ? JSON.stringify(jsonStringifyValue).slice(1,-1)
                : hasInitializer?getStringLiteralContents(initializerTokens.join('')):'']
    }
    data.element = new DataElement(kind,name,arrayType?classType?.name??arrayType[1]:type??'',arrayType?value:values.join(' ')??'')
    data.element.declaredType = declaredType
    if(resolvedType?.numericKind){
        data.element.numericKind = resolvedType.numericKind
    }
    if(classReturnCall){
        data.element.isReferenceAlias = true
        data.element.isHeapAllocated = true
        classReturnCall.resultTarget = data.element
        data.initializerCalls.push(classReturnCall)
        data.runtimeCallInitializer = true
    }else if(type==='string'&&returnedValueCall?.func?.returnType==='string'){
        returnedValueCall.resultTarget = data.element
        data.initializerCalls.push(returnedValueCall)
        data.runtimeCallInitializer = true
    }
    if(hasPromiseInitializer&&data.parent){
        data.promiseInitializer = parsePromiseInitializer(
            data.parent,
            data.element,
            promiseInitializerExpression,
            type
        )
    }
    if(jsonParseValue!==undefined){
        data.element.jsonValue = jsonParseValue
    }else if(jsonStringifyValue!==null){
        data.element.jsonValue = jsonStringifyValue
    }else if(classLayout&&data.parent){
        data.element.jsonValue = getJSONValueFromProperties(classLayout.props,data.parent)
    }else if(data.parent){
        data.element.jsonValue = getJSONValueFromData(data.element,data.parent)
    }
    if(toStringInitializer&&data.parent){
        const toStringCall = new Call(data.parent)
        toStringCall.set(new Tokenizer(initializerTokens.join('')))
        const isArrayToString = Boolean(arrayToStringInitializer
            &&toStringCall.params.length===0
            &&toStringCall.builtinArrayToString)
        const isArrayBufferToString = Boolean(arrayBufferToStringInitializer
            &&toStringCall.params.length===0
            &&toStringCall.builtinArrayBufferToString)
        if(!isArrayToString&&!isArrayBufferToString){
            throw new Error(`Unable to resolve toString call "${initializerTokens.join('')}"`)
        }
        toStringCall.resultTarget = data.element
        data.initializerCalls.push(toStringCall)
        data.runtimeCallInitializer = true
    }
    if(chainedMethodCall&&type==='string'&&data.parent){
        const [,callExpression,methodName] = chainedMethodCall
        const callTokenizer = new Tokenizer(callExpression)
        const initializerCall = new Call(data.parent)
        initializerCall.set(callTokenizer)
        if(callTokenizer.has()){
            throw new Error('Invalid function call in chained method initializer')
        }
        const isArrayBufferResult = initializerCall.func?.returnType==='ArrayBuffer'
        const className = isArrayBufferResult
            ? 'ArrayBuffer'
            : initializerCall.func?.returnClassType
                ??(initializerCall.func?.returnType?data.parent.getClass(initializerCall.func.returnType)?.name:null)
        const classType = className?data.parent.getClass(className):null
        const method = classType?.getFunction(methodName)
        if(!className||(!isArrayBufferResult&&!method)||isArrayBufferResult&&methodName!=='toString'){
            throw new Error(`Unable to resolve method "${methodName}" on returned class`)
        }
        if(!isArrayBufferResult&&(method!.params.length||method!.returnType!=='string')){
            throw new Error(`Chained method "${methodName}" must take no arguments and return a string`)
        }
        let temporaryName = ''
        do{
            temporaryName = `__ds_call_result_${nextCallResultId()}`
        }while(data.parent.getData(temporaryName))
        const temporary = new DataElement('let',temporaryName,className,'0')
        temporary.classType = isArrayBufferResult?null:className
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
        data.element.arrayLength = data.arrayInitializerCall
            ? null
            : arrayObjectValues?.length??arrayValues.length
        data.element.arrayObjectValues = arrayObjectValues
        data.element.numericKind = data.arrayInitializerCall?.func?.returnArrayNumericKind
            ??(arrayType[1]==='number'&&arrayValues.some(item=>getNumericKind(item)==='float')?'float':'integer')
        if(classType){
            data.element.classType = classType.name
        }
    }
    if(typedArrayInitializer){
        data.element.isArray = true
        data.element.dynamicArray = false
        data.element.arrayLength = typedArrayInitializer.values.length
        data.element.numericKind = typedArrayInitializer.kind.startsWith('Float')?'float':'integer'
        data.element.typedArrayKind = typedArrayInitializer.kind
        data.element.typedArrayValues = typedArrayInitializer.values
        data.element.typedArrayBytes = typedArrayInitializer.bytes
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
        data.runtimeInitializer = initializer
    }
    if(isAsyncInitializer&&data.parent){
        const initializer = new Assign(data.parent)
        initializer.setTask(data.element,initializerTokens.join(''))
        data.parent.children.push(initializer)
    }
}
