import Tokenizer from '../../tokenizer.ts'
import Base from '../base.ts'
import DataElement, {type JsonValue} from '../dataElement.ts'
import ClassElement from '../clasElement.ts'
import {getClassPropertyAccess} from '../clasElement.ts'
import {decodeStringEscapes,getStringLiteralContents} from '../../stringLiteral.ts'
import {splitTopLevelArrayValues} from './arrays.ts'
import {nextStructLayoutId} from './ids.ts'
import type {JSONArrayLayout,ObjectLiteralProperty} from './types.ts'
import {getDynamicJSONAccess} from './jsonAccess.ts'

export function createJSONDataElement(property:ObjectLiteralProperty){
    const element = new DataElement('let',property.name,property.type,property.value)
    element.classType = property.classType??null
    element.isArray = property.isArray??false
    element.dynamicArray = property.dynamicArray??false
    element.arrayObjectValues = property.arrayObjectValues??null
    element.jsonValue = property.jsonValue
    return element
}

function getJSONCallArguments(tokens:string[],name:'JSON.parse'|'JSON.stringify'){
    if(tokens[0]!==name){
        return null
    }
    if(tokens[1]!=='('||tokens[tokens.length-1]!==')'){
        throw new Error(`Invalid ${name} call`)
    }
    const callTokenizer = new Tokenizer(tokens.join(''))
    callTokenizer.get()
    callTokenizer.get()
    const args = callTokenizer.getCallArguments()
    if(callTokenizer.has()){
        throw new Error(`Invalid ${name} call`)
    }
    return args
}

function getJSONParseText(tokens:string[],active:Base){
    const args = getJSONCallArguments(tokens,'JSON.parse')
    if(!args){
        return null
    }
    if(args.length!==1){
        throw new Error('JSON.parse expects exactly one argument')
    }
    const argument = args[0]
    let jsonText:string
    if(/^(['"])[\s\S]*\1$/.test(argument)){
        jsonText = decodeStringEscapes(getStringLiteralContents(argument))
    }else if(/^[a-z_$][\w$]*$/i.test(argument)){
        const source = active.getData(argument)
        if(!source||source.kind!=='const'||source.type!=='string'||source.isArray||source.value===null||source.isRuntimeValue){
            throw new Error('JSON.parse currently requires a string literal or const string')
        }
        jsonText = decodeStringEscapes(source.value)
    }else{
        throw new Error('JSON.parse currently requires a string literal or const string')
    }

    return jsonText
}

export function getRuntimeJSONParseArgument(tokens:string[],active:Base):string|null{
    const args = getJSONCallArguments(tokens,'JSON.parse')
    if(!args){
        return null
    }
    if(args.length!==1){
        throw new Error('JSON.parse expects exactly one argument')
    }
    const argument = args[0].trim()
    if(/^(['"])[\s\S]*\1$/.test(argument)){
        return null
    }
    const source = active.getData(argument)
    if(source?.type==='string'&&!source.isArray){
        if(source.kind==='const'&&source.value!==null&&!source.isRuntimeValue){
            return null
        }
        return argument
    }
    const property = getClassPropertyAccess(active,argument)
    if(property?.property.type==='string'&&!property.property.isArray){
        return argument
    }
    throw new Error('JSON.parse expects a string literal, const string, or runtime string value')
}

export function getRuntimeJSONStringifyArgument(tokens:string[],active:Base):string|null{
    const args = getJSONCallArguments(tokens,'JSON.stringify')
    if(!args){
        return null
    }
    if(args.length<1||args.length>3){
        throw new Error('JSON.stringify expects between one and three arguments')
    }
    const argument = args[0].trim()
    const parseArgument = new Tokenizer(argument).tokens
    if(getRuntimeJSONParseArgument(parseArgument,active)!==null){
        return argument
    }
    if(getDynamicJSONAccess(argument,active)){
        return argument
    }
    const source = active.getData(argument)
    if(source&&!source.isArray&&source.isDynamicJSON){
        return argument
    }
    return null
}

export function isJSONObject(value:JsonValue):value is {[key:string]:JsonValue}{
    return value!==null&&typeof value==='object'&&!Array.isArray(value)
}

function getJSONShape(value:JsonValue):string{
    if(value===null){
        return 'null'
    }
    if(Array.isArray(value)){
        return `array:${value.map(getJSONShape).join(',')}`
    }
    if(typeof value==='object'){
        return `object:${Object.keys(value).sort().map(key=>`${key}:${getJSONShape(value[key])}`).join(',')}`
    }
    return typeof value
}

function createJSONClass(value:{[key:string]:JsonValue},active:Base):ClassElement{
    const type = `__ds_struct_${nextStructLayoutId()}`
    const properties = createJSONProperties(value,active).map(createJSONDataElement)
    const classType = new ClassElement(type,properties,[])
    active.addClass(classType)
    return classType
}

export function createJSONArrayLayout(values:JsonValue[],active:Base):JSONArrayLayout{
    if(!values.length){
        return {type:'any',values:[],classType:null,arrayObjectValues:null,dynamicArray:true}
    }
    const shape = getJSONShape(values[0])
    if(values.some(value=>getJSONShape(value)!==shape)){
        return {type:'any',values:values.map(()=>'0'),classType:null,arrayObjectValues:null,dynamicArray:false}
    }
    const first = values[0]
    if(typeof first==='string'){
        return {
            type:'string',
            values:values.map(value=>JSON.stringify(value)),
            classType:null,
            arrayObjectValues:null,
            dynamicArray:false
        }
    }
    if(typeof first==='number'){
        if(values.some(value=>typeof value!=='number'||!Number.isFinite(value))){
            throw new Error('JSON.parse arrays must contain finite numbers')
        }
        return {
            type:'number',
            values:values.map(String),
            classType:null,
            arrayObjectValues:null,
            dynamicArray:false
        }
    }
    if(typeof first==='boolean'){
        return {
            type:'boolean',
            values:values.map(value=>value?'1':'0'),
            classType:null,
            arrayObjectValues:null,
            dynamicArray:false
        }
    }
    if(first===null){
        return {
            type:'null',
            values:values.map(()=>'0'),
            classType:null,
            arrayObjectValues:null,
            dynamicArray:false
        }
    }
    if(isJSONObject(first)){
        const classType = createJSONClass(first,active)
        const arrayObjectValues = values.map(value=>
            createJSONProperties(value as {[key:string]:JsonValue},active).map(createJSONDataElement)
        )
        return {
            type:classType.name!,
            values:values.map(()=>'0'),
            classType,
            arrayObjectValues,
            dynamicArray:false
        }
    }
    return {type:'any',values:values.map(()=>'0'),classType:null,arrayObjectValues:null,dynamicArray:false}
}

function createJSONProperty(name:string,value:JsonValue,active:Base):ObjectLiteralProperty{
    if(!/^[a-z_$][\w$]*$/i.test(name)){
        throw new Error(`JSON.parse property "${name}" is not a supported identifier`)
    }
    if(typeof value==='string'){
        return {name,type:'string',value:JSON.stringify(value).slice(1,-1),jsonValue:value}
    }
    if(typeof value==='number'){
        if(!Number.isFinite(value)){
            throw new Error(`JSON.parse property "${name}" must be a finite number`)
        }
        return {name,type:'number',value:String(value),jsonValue:value}
    }
    if(typeof value==='boolean'){
        return {name,type:'boolean',value:value?'1':'0',jsonValue:value}
    }
    if(value===null){
        return {name,type:'null',value:'0',jsonValue:null}
    }
    if(Array.isArray(value)){
        const layout = createJSONArrayLayout(value,active)
        return {
            name,
            type:layout.type,
            value:layout.values.join(', ')||'0',
            classType:layout.classType?.name??undefined,
            isArray:true,
            dynamicArray:layout.dynamicArray,
            arrayObjectValues:layout.arrayObjectValues,
            jsonValue:value
        }
    }
    const classType = createJSONClass(value,active)
    return {name,type:classType.name!,value:'0',classType:classType.name!,jsonValue:value}
}

export function createJSONProperties(value:{[key:string]:JsonValue},active:Base):ObjectLiteralProperty[]{
    return Object.entries(value).map(([name,item])=>createJSONProperty(name,item,active))
}

export function parseJSONParseInitializer(tokens:string[],active:Base):JsonValue|undefined{
    if(getRuntimeJSONParseArgument(tokens,active)!==null){
        return undefined
    }
    const jsonText = getJSONParseText(tokens,active)
    if(jsonText===null){
        return undefined
    }
    let parsed:JsonValue
    try{
        parsed = JSON.parse(jsonText) as JsonValue
    }catch(error){
        const message = error instanceof Error?error.message:String(error)
        throw new Error(`Invalid JSON passed to JSON.parse: ${message}`)
    }
    return parsed
}

export function getJSONValueFromProperties(properties:DataElement[],active:Base):JsonValue|undefined{
    const result:{[key:string]:JsonValue} = {}
    for(const property of properties){
        const value = getJSONValueFromData(property,active)
        if(value===undefined){
            return undefined
        }
        result[property.name??''] = value
    }
    return result
}

export function getJSONValueFromData(data:DataElement,active:Base):JsonValue|undefined{
    if(data.isRuntimeValue){
        return undefined
    }
    if(data.jsonValue!==undefined){
        return data.jsonValue
    }
    if(data.isArray){
        if(data.arrayObjectValues){
            const objects = data.arrayObjectValues.map(properties=>getJSONValueFromProperties(properties,active))
            return objects.every((value):value is JsonValue=>value!==undefined)?objects:undefined
        }
        const items = splitTopLevelArrayValues(data.value??'')
        if(data.type==='string'){
            return items.map(value=>decodeStringEscapes(getStringLiteralContents(value)))
        }
        if(data.type==='number'){
            const values = items.map(Number)
            return values.every(Number.isFinite)?values:undefined
        }
        if(data.type==='boolean'){
            return items.map(value=>value!=='0')
        }
        if(data.type==='null'){
            return items.map(()=>null)
        }
        return undefined
    }
    if(data.type==='string'&&!data.isArray&&data.value!==null){
        return decodeStringEscapes(data.value)
    }
    if(data.type==='number'&&!data.isArray&&data.value!==null){
        const value = Number(data.value)
        return Number.isFinite(value)?value:undefined
    }
    if(data.type==='boolean'){
        return data.value==='1'
    }
    if(data.type==='null'){
        return null
    }
    if(data.classLayoutProps){
        return getJSONValueFromProperties(data.classLayoutProps,active)
    }
    if(data.classType){
        const classType = active.getClass(data.classType)
        return classType?getJSONValueFromProperties(classType.props,active):undefined
    }
    return undefined
}

function getJSONValueFromExpression(expression:string,active:Base):JsonValue|undefined{
    const root = expression.match(/^[a-z_$][\w$]*/i)?.[0]
    const source = root?active.getData(root):null
    if(!root||!source){
        return undefined
    }
    let value = getJSONValueFromData(source,active)
    if(value===undefined){
        return undefined
    }
    let index = root.length
    while(index<expression.length){
        if(expression[index]==='.'){
            const property = expression.slice(index+1).match(/^[a-z_$][\w$]*/i)?.[0]
            if(!property||!isJSONObject(value)||!Object.prototype.hasOwnProperty.call(value,property)){
                return undefined
            }
            value = value[property]
            index += property.length+1
            continue
        }
        if(expression[index]==='['){
            const close = expression.indexOf(']',index+1)
            const elementIndex = close===-1?-1:Number(expression.slice(index+1,close))
            if(close===-1||!Number.isInteger(elementIndex)||elementIndex<0||!Array.isArray(value)||elementIndex>=value.length){
                return undefined
            }
            value = value[elementIndex]
            index = close+1
            continue
        }
        return undefined
    }
    return value
}

export function parseJSONStringifyInitializer(tokens:string[],active:Base):string|null{
    const args = getJSONCallArguments(tokens,'JSON.stringify')
    if(!args){
        return null
    }
    if(args.length<1||args.length>3){
        throw new Error('JSON.stringify expects between one and three arguments')
    }
    if(getRuntimeJSONStringifyArgument(tokens,active)!==null){
        return null
    }
    const argument = args[0]
    let value:JsonValue|undefined
    if(/^JSON\.parse\([\s\S]*\)$/.test(argument)){
        if(getRuntimeJSONParseArgument(new Tokenizer(argument).tokens,active)!==null){
            return null
        }
        const parsed = parseJSONParseInitializer(new Tokenizer(argument).tokens,active)
        value = parsed
    }else if(/^(['"])[\s\S]*\1$/.test(argument)){
        value = decodeStringEscapes(getStringLiteralContents(argument))
    }else if(argument==='true'||argument==='false'||argument==='null'){
        value = argument==='null'?null:argument==='true'
    }else if(/^[+-]?(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(argument)){
        const numeric = Number(argument.replace(/f$/i,''))
        if(Number.isFinite(numeric)){
            value = numeric
        }
    }else{
        value = getJSONValueFromExpression(argument,active)
    }
    if(value===undefined){
        throw new Error('JSON.stringify currently requires a compile-time JSON value')
    }
    let replacer:(string|number)[]|null = null
    if(args.length>=2&&args[1]!=='null'&&args[1]!=='undefined'){
        const replacerArgument = args[1]
        if(!replacerArgument.startsWith('[')||!replacerArgument.endsWith(']')){
            throw new Error('JSON.stringify compile-time replacer must be null, undefined, or an array of strings and numbers')
        }
        replacer = splitTopLevelArrayValues(replacerArgument.slice(1,-1)).map(item=>{
            if(/^(['"])[\s\S]*\1$/.test(item)){
                return decodeStringEscapes(getStringLiteralContents(item))
            }
            if(/^[+-]?(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(item)){
                const numeric = Number(item.replace(/f$/i,''))
                if(Number.isFinite(numeric)){
                    return numeric
                }
            }
            throw new Error('JSON.stringify compile-time replacer arrays support only string and number literals')
        })
    }
    let space:string|number|undefined
    if(args.length===3&&args[2]!=='null'&&args[2]!=='undefined'){
        const spaceArgument = args[2]
        if(/^(['"])[\s\S]*\1$/.test(spaceArgument)){
            space = decodeStringEscapes(getStringLiteralContents(spaceArgument))
        }else if(/^[+-]?(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(spaceArgument)){
            space = Number(spaceArgument.replace(/f$/i,''))
            if(!Number.isFinite(space)){
                throw new Error('JSON.stringify space must be a finite number or string literal')
            }
        }else{
            throw new Error('JSON.stringify space must be null, undefined, or a number or string literal')
        }
    }
    const result = JSON.stringify(value,replacer,space)
    if(result===undefined){
        throw new Error('Unable to serialize JSON.stringify argument')
    }
    return result
}

