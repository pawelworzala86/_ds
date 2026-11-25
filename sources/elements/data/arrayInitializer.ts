import Tokenizer from '../../tokenizer.ts'
import DataElement from '../dataElement.ts'
import ClassElement from '../clasElement.ts'
import Call from '../call.ts'
import {splitTopLevelArrayValues,splitTokenArrayValues} from './arrays.ts'
import {createStructLayout,parseObjectLiteral} from './struct.ts'
import type {JSONArrayLayout} from './types.ts'
import type Data from '../data.ts'

export function initializeArray(data:Data,name:string,tokens:string[],initializerTokens:string[],arrayType:RegExpMatchArray|null|undefined,jsonRootArray:JSONArrayLayout|null,initialValue:string,eq:string|undefined){
    let value = initialValue
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
    const classType = data.parent?.getClass(itemType)
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
            const source = data.parent?.getData(sourceName)
            const properties = source?.classLayoutProps
                ??(source?.classType?data.parent?.getClass(source.classType)?.props:null)
            if(!source||source.isArray||!properties){
                throw new Error(`Object.keys expects a struct identifier, received "${sourceName}"`)
            }
            arrayValues = properties.map(property=>`'${property.name}'`)
            value = arrayValues.join(', ')
        }else{
            const callTokenizer = new Tokenizer(initializerTokens.join(''))
            const call = new Call(data)
            call.set(callTokenizer)
            if(callTokenizer.has()||call.func?.returnArrayType!==`${itemType}[]`){
                throw new Error(`Array "${name}" must be initialized with an array literal or a function returning "${itemType}[]"`)
            }
            data.arrayInitializerCall = call
            data.children.push(call)
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
            if(!arrayValues.length){
                value = ''
            }else{
                const objectTokens = arrayValues.map(item=>new Tokenizer(item).tokens)
                if(objectTokens.some(item=>item[0]!=='{')){
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
                data.parent?.addClass(inferredArrayClass)
                arrayObjectValues = objectProperties.map(properties=>shape.map(property=>{
                    const value = properties.find(item=>item.name===property.name)!
                    return new DataElement('let',value.name,value.type,value.value)
                }))
                value = arrayValues.join(', ')
            }
        }
    }
}
    return {arrayValues,arrayObjectValues,inferredArrayClass,value}
}
