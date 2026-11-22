import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from './../asm.ts'
import DataElement, {getNumericKind} from './dataElement.ts'
import Assign from './assign.ts'
import ClassElement, {getClassPropertyAccess} from './clasElement.ts'
import Call from './call.ts'
import {getStringLiteralContents} from '../stringLiteral.ts'
import {parseJSONParseInitializer,parseJSONStringifyInitializer,createJSONArrayLayout,getJSONValueFromProperties,getJSONValueFromData,isJSONObject,createJSONProperties,createJSONDataElement} from './data/json.ts'
import {createStructLayout,parseObjectLiteral} from './data/struct.ts'
import {splitTopLevelArrayValues,splitTokenArrayValues} from './data/arrays.ts'
import {nextStructLayoutId} from './data/ids.ts'
import type {JSONArrayLayout} from './data/types.ts'
import {emitDataAsm} from './data/asm.ts'

export class Data extends Base{
    element:DataElement|null = null
    initializerCall:Call|null = null
    arrayInitializerCall:Call|null = null
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer,classField=false){
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
            this.setDestructure(tokens)
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
        const jsonParseValue = hasInitializer&&this.parent
            ? parseJSONParseInitializer(initializerTokens,this.parent)
            : undefined
        const jsonStringifyValue = hasInitializer&&this.parent
            ? parseJSONStringifyInitializer(initializerTokens,this.parent)
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
            ||asyncFunctionName&&this.parent?.getFunction(asyncFunctionName)?.isAsync
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
        if(jsonParseValue!==undefined&&this.parent){
            if(isJSONObject(jsonParseValue)){
                const properties = createJSONProperties(jsonParseValue,this.parent).map(createJSONDataElement)
                const className = `__ds_struct_${nextStructLayoutId()}`
                jsonParseClass = new ClassElement(className,properties,[])
                this.parent.addClass(jsonParseClass)
                type = className
            }else if(Array.isArray(jsonParseValue)){
                jsonRootArray = createJSONArrayLayout(jsonParseValue,this.parent)
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
        let arrayValues:string[] = []
        let arrayObjectValues:DataElement[][]|null = null
        let inferredArrayClass:ClassElement|null = null
        if(jsonRootArray){
            arrayValues = jsonRootArray.values
            arrayObjectValues = jsonRootArray.arrayObjectValues
            inferredArrayClass = jsonRootArray.classType
            value = arrayValues.join(', ')
        }
        if(arrayType&&!jsonRootArray){
            const itemType = arrayType[1]
            const classType = this.parent?.getClass(itemType)
            const allowedItemTypes = ['number','string','boolean']
            if((!allowedItemTypes.includes(itemType)&&!classType&&itemType!=='any')||eq!=='='){
                throw new Error(`Array "${name}" must be initialized with an array literal`)
            }
            const initializerStart = tokens.indexOf('=') + 1
            const initializer = tokens.slice(initializerStart).join(' ')
                .replace(/\s+/g,' ')
                .replace(/\s*\(\s*/g,'(')
                .replace(/\s*\)\s*/g,')')
                .replace(/\s*,\s*/g,',')
                .replace(/\s*\[\s*/g,'[')
                .replace(/\s*\]\s*/g,']')
                .replace(/;$/,'')
            const arrayLiteral = initializer.match(/^\[([\s\S]*)\]$/)
            if(!arrayLiteral){
                const objectKeysInitializer = initializerTokens.length===4
                    &&initializerTokens[0]==='Object.keys'
                    &&initializerTokens[1]==='('
                    &&initializerTokens[3]===')'
                if(objectKeysInitializer){
                    const sourceName = initializerTokens[2]
                    const source = this.parent?.getData(sourceName)
                    const properties = source?.classLayoutProps
                        ??(source?.classType?this.parent?.getClass(source.classType)?.props:null)
                    if(!source||source.isArray||!properties){
                        throw new Error(`Object.keys expects a struct identifier, received "${sourceName}"`)
                    }
                    arrayValues = properties.map(property=>`'${property.name}'`)
                    value = arrayValues.join(', ')
                }else{
                    const callTokenizer = new Tokenizer(initializerTokens.join(''))
                    const call = new Call(this)
                    call.set(callTokenizer)
                    if(callTokenizer.has()||call.func?.returnArrayType!==`${itemType}[]`){
                        throw new Error(`Array "${name}" must be initialized with an array literal or a function returning "${itemType}[]"`)
                    }
                    this.arrayInitializerCall = call
                    this.children.push(call)
                    value = ''
                }
            }else{
                arrayValues = splitTopLevelArrayValues(arrayLiteral[1])
                if(itemType==='number'){
                    if(arrayValues.some(item=>!item||!/^[+-]?(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(item))){
                        throw new Error(`Array "${name}" must contain numeric literals`)
                    }
                    value = arrayValues.join(', ')
                }else if(itemType==='string'){
                    arrayValues = splitTokenArrayValues(initializerTokens).map(item=>item.join(''))
                    if(arrayValues.some(item=>!item||!(/^'(?:\\.|[^'])*'$/.test(item)||/^"(?:\\.|[^"])*"$/.test(item)))){
                        throw new Error(`Array "${name}" must contain string literals`)
                    }
                    value = arrayValues.join(', ')
                }else if(itemType==='boolean'){
                    if(arrayValues.some(item=>item!=='true'&&item!=='false')){
                        throw new Error(`Array "${name}" must contain boolean literals`)
                    }
                    arrayValues = arrayValues.map(item=>item==='true'?'1':'0')
                    value = arrayValues.join(', ')
                }else if(classType){
                    if(arrayValues.some(item=>!item||!new RegExp(`^new\\s+${itemType.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*\\(\\s*\\)$`,`i`).test(item.trim()))){
                        throw new Error(`Array "${name}" must contain "new ${itemType}()" initializers`)
                    }
                    value = arrayValues.join(', ')
                }else if(itemType==='any'){
                    const objectTokens = splitTokenArrayValues(initializerTokens)
                    if(!objectTokens.length||objectTokens.some(item=>item[0]!=='{')){
                        throw new Error(`Array "${name}" must contain object literals`)
                    }
                    const objectProperties = objectTokens.map(item=>parseObjectLiteral(item))
                    const shape = objectProperties[0]
                    if(objectProperties.some(properties=>
                        properties.length!==shape.length
                        ||shape.some(property=>!properties.some(value=>value.name===property.name&&value.type===property.type))
                    )){
                        throw new Error(`Objects in array "${name}" must have the same properties and types`)
                    }
                    const layout = createStructLayout(shape,null,name)
                    inferredArrayClass = new ClassElement(layout.type,layout.props,[])
                    this.parent?.addClass(inferredArrayClass)
                    arrayObjectValues = objectProperties.map(properties=>shape.map(property=>{
                        const value = properties.find(item=>item.name===property.name)!
                        return new DataElement('let',value.name,value.type,value.value)
                    }))
                    value = arrayValues.join(', ')
                }
            }
        }
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
                    const source = this.parent?.getData(expression)
                    const sourceAccess = this.parent?getClassPropertyAccess(this.parent,expression):null
                    let isBooleanCall = false
                    if(/^[a-z_$][\w.$]*\([\s\S]*\)$/i.test(expression)){
                        const callTokenizer = new Tokenizer(expression)
                        const call = new Call(this.parent!)
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
        let classType = inferredArrayClass??jsonParseClass??(normalizedType?this.parent?.getClass(normalizedType):null)
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
            this.parent?.addClass(classType)
            type = classLayout.type
        }
        let values = [value]
        if(type=='string'){
            values = [jsonParseValue!==undefined
                ? JSON.stringify(jsonParseValue).slice(1,-1)
                : jsonStringifyValue!==null
                    ? JSON.stringify(jsonStringifyValue).slice(1,-1)
                    : hasInitializer?getStringLiteralContents(initializerTokens.join('')):'']
        }
        this.element = new DataElement(kind,name,arrayType?classType?.name??arrayType[1]:type??'',arrayType?value:values.join(' ')??'')
        if(jsonParseValue!==undefined){
            this.element.jsonValue = jsonParseValue
        }else if(jsonStringifyValue!==null){
            this.element.jsonValue = jsonStringifyValue
        }else if(classLayout&&this.parent){
            this.element.jsonValue = getJSONValueFromProperties(classLayout.props,this.parent)
        }else if(this.parent){
            this.element.jsonValue = getJSONValueFromData(this.element,this.parent)
        }
        if(classLayout){
            this.element.classLayoutType = classLayout.type
            this.element.classLayoutProps = classLayout.props
        }
        if(arrayType){
            this.element.isArray = true
            this.element.dynamicArray = arrayValues.length===0
            this.element.arrayObjectValues = arrayObjectValues
            this.element.numericKind = this.arrayInitializerCall?.func?.returnArrayNumericKind
                ??(arrayType[1]==='number'&&arrayValues.some(item=>getNumericKind(item)==='float')?'float':'integer')
            if(classType){
                this.element.classType = classType.name
            }
        }
        if(!arrayType){
            this.element.classType = classType?.name??null
        }
        this.element.isConstAlias = kind==='const'
            &&type==='number'
            &&!arrayType
            &&!classType
            &&!runtimeInitializer
            &&/^[+-]?(?:0x[0-9a-f]+|[0-9a-f]+h|\d+)$/i.test(value??'')
        this.element.isExportedConstAlias = this.element.isConstAlias
            &&Boolean(this.parent?.EXPORT[name])
        this.parent?.addData(this.element)
        if(!classField&&classInitializerArgs&&this.parent&&classType){
            const constructor = classType.getFunction('constructor')
            if(constructor){
                if(classInitializerArgs.length!==constructor.params.length){
                    throw new Error(`Constructor for "${classType.name}" expects ${constructor.params.length} arguments, received ${classInitializerArgs.length}`)
                }
                this.initializerCall = new Call(this.parent)
                this.initializerCall.set(new Tokenizer(`${this.element.name}.constructor(${classInitializerArgs.join(',')})`))
            }else if(classInitializerArgs.length){
                throw new Error(`Class "${classType.name}" has no constructor`)
            }
        }
        if(runtimeInitializer&&numericExpression&&this.parent){
            const initializer = new Assign(this.parent)
            initializer.setExpression(this.element,numericExpression,true)
            this.parent.children.push(initializer)
        }
        if(isAsyncInitializer&&this.parent){
            const initializer = new Assign(this.parent)
            initializer.setTask(this.element,initializerTokens.join(''))
            this.parent.children.push(initializer)
        }
    }
    setDestructure(tokens:string[]){
        const close = tokens.indexOf('}')
        const equals = tokens.indexOf('=')
        const sourceName = tokens[equals+1]
        if(close<2||equals!==close+1||!sourceName||equals!==tokens.length-2){
            throw new Error('Invalid struct destructuring declaration')
        }
        const source = this.parent?.getData(sourceName)
        const classType = source?.classType?this.parent?.getClass(source.classType):null
        if(!source||!classType||source.isArray){
            throw new Error(`Cannot destructure non-struct value "${sourceName}"`)
        }
        const names = tokens.slice(2,close).filter(token=>token!==',')
        if(!names.length||names.some(name=>!/^[a-z_$][\w$]*$/i.test(name))){
            throw new Error('Invalid property in struct destructuring declaration')
        }
        if(new Set(names).size!==names.length){
            throw new Error('Duplicate property in struct destructuring declaration')
        }
        for(const name of names){
            const property = classType.props.find(item=>item.name===name)
            if(!property){
                throw new Error(`Unknown property "${name}" in struct "${classType.name}"`)
            }
            if(property.isArray||property.classType||!['number','string','boolean'].includes(property.type??'')){
                throw new Error(`Struct destructuring does not support array or nested property "${name}"`)
            }
            const layoutProperty = source.classLayoutProps?.find(item=>item.name===name)
            const value = layoutProperty?.value??property.value??''
            const element = new DataElement(tokens[0],name,property.type??'',property.type==='number'||property.type==='boolean'?'0':value)
            this.parent?.addData(element)
            const declaration = new Data(this.parent!)
            declaration.element = element
            this.parent?.children.push(declaration)
            if(property.type==='number'||property.type==='boolean'){
                const initializer = new Assign(this.parent!)
                initializer.setExpression(element,`${sourceName}.${name}`,true)
                this.parent?.children.push(initializer)
            }
        }
    }
    asm(ASM:Asm){
        emitDataAsm(this,ASM)
    }
    static test(active:Base,tokenizer:Tokenizer,classField=false){
        const token = tokenizer.get()
        const next = tokenizer.get()
        tokenizer.move(-2)
        const isClassField = classField&&next===':'
        if(['let','var','const'].includes(token)||isClassField){
            const data = new Data(active)
            data.set(tokenizer,isClassField)
            active.children.push(data)
            if(data.initializerCall){
                active.children.push(data.initializerCall)
            }
            return data
        }
        return null
    }
}

export default Data