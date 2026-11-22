import Asm from '../../asm.ts'
import {decodeStringEscapes,getStringLiteralContents,stringLiteralData} from '../../stringLiteral.ts'
import {splitTopLevelArrayValues} from '../data/arrays.ts'
import type {Call} from '../call.ts'

let arrayToStringId = 0

function getArrayText(call:Call){
    const array = call.builtinArrayToString
    if(!array){
        throw new Error('Array.toString receiver is missing')
    }
    if(array.arrayHasMutation||array.dynamicArray&&(array.arrayLength!==0||array.isParameter)){
        throw new Error('Array.toString is only supported for arrays with compile-time-known values')
    }
    if(array.typedArrayValues){
        return array.typedArrayValues.map(value=>String(value)).join(',')
    }
    if(array.arrayObjectValues){
        return array.arrayObjectValues.map(()=> '[object Object]').join(',')
    }
    if(array.classType){
        return splitTopLevelArrayValues(array.value??'').map(()=> '[object Object]').join(',')
    }
    const values = splitTopLevelArrayValues(array.value??'')
    if(array.type==='string'){
        return values.map(value=>decodeStringEscapes(getStringLiteralContents(value))).join(',')
    }
    if(array.type==='boolean'){
        return values.map(value=>value==='1'||value==='true'?'true':'false').join(',')
    }
    if(array.type==='number'){
        return values.map(value=>String(Number(value.replace(/f$/i,'')))).join(',')
    }
    throw new Error(`Array.toString does not support element type "${array.type}"`)
}

export function emitArrayToString(call:Call,ASM:Asm){
    const text = getArrayText(call)
    const label = `__ds_array_to_string_${++arrayToStringId}`
    ASM.addData(`${label} ${stringLiteralData(JSON.stringify(text))}`)
    ASM.addCode(`lea rax, [${label}]`)
}
