import DataElement from '../dataElement.ts'
import type FunctionArgument from '../functionArgument.ts'
import type {Call} from '../call.ts'

export function validateArrayPush(call:Call,array:DataElement,param:FunctionArgument){
        if(array.type==='any'){
            return
        }
        const elementType = param.value instanceof DataElement
            ? param.value.type
            : param.arrayElementAccess?.array.type??param.arrayPropertyAccess?.property.type
        const elementClass = param.value instanceof DataElement
            ? param.value.classType
            : param.arrayElementAccess?.array.classType
        if(array.type==='number'){
            if(elementType&&elementType!=='number'){
                throw new Error(`Array.push for "${array.name}" requires a number`)
            }
            if(param.expression?.numericKind==='float'||param.value instanceof DataElement&&param.value.numericKind==='float'||param.arrayElementAccess?.array.numericKind==='float'){
                array.numericKind = 'float'
            }
            return
        }
        if(array.type==='string'){
            const literal = typeof param.value==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(param.value)
            if(!literal&&elementType!=='string'){
                throw new Error(`Array.push for "${array.name}" requires a string`)
            }
            return
        }
        if(array.type==='boolean'){
            const literal = typeof param.value==='string'&&(param.value==='true'||param.value==='false')
            if(!literal&&elementType!=='boolean'){
                throw new Error(`Array.push for "${array.name}" requires a boolean`)
            }
            return
        }
        if(array.classType){
            if(elementClass!==array.classType){
                throw new Error(`Array.push for "${array.name}" requires an instance of ${array.classType}`)
            }
            return
        }
        throw new Error(`Array.push is not supported for "${array.name}"`)
    }
