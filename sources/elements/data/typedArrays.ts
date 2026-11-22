import type Base from '../base.ts'
import {splitTopLevelArrayValues} from './arrays.ts'

export type TypedArrayKind =
    |'Int8Array'
    |'Uint8Array'
    |'Uint8ClampedArray'
    |'Int16Array'
    |'Uint16Array'
    |'Int32Array'
    |'Uint32Array'
    |'Float32Array'
    |'Float64Array'
    |'BigInt64Array'
    |'BigUint64Array'

export type TypedArrayValue = number|bigint

type TypedArrayInfo = {
    bytesPerElement:number
    float:boolean
    signed:boolean
    clamped?:boolean
    bigint?:boolean
}

const typedArrayInfo:Record<TypedArrayKind,TypedArrayInfo> = {
    Int8Array:{bytesPerElement:1,float:false,signed:true},
    Uint8Array:{bytesPerElement:1,float:false,signed:false},
    Uint8ClampedArray:{bytesPerElement:1,float:false,signed:false,clamped:true},
    Int16Array:{bytesPerElement:2,float:false,signed:true},
    Uint16Array:{bytesPerElement:2,float:false,signed:false},
    Int32Array:{bytesPerElement:4,float:false,signed:true},
    Uint32Array:{bytesPerElement:4,float:false,signed:false},
    Float32Array:{bytesPerElement:4,float:true,signed:true},
    Float64Array:{bytesPerElement:8,float:true,signed:true},
    BigInt64Array:{bytesPerElement:8,float:false,signed:true,bigint:true},
    BigUint64Array:{bytesPerElement:8,float:false,signed:false,bigint:true}
}

export function getTypedArrayInfo(kind:string|null|undefined):TypedArrayInfo|null{
    return kind&&kind in typedArrayInfo?typedArrayInfo[kind as TypedArrayKind]:null
}

export function getTypedArrayKind(value:string|null|undefined):TypedArrayKind|null{
    return value&&value in typedArrayInfo?value as TypedArrayKind:null
}

export function convertTypedArrayValues(kind:TypedArrayKind,values:TypedArrayValue[]):TypedArrayValue[]{
    const info = typedArrayInfo[kind]
    return values.map(value=>{
        if(info.bigint){
            if(typeof value!=='bigint'){
                throw new Error(`${kind} values must be bigint literals`)
            }
            const modulus = 1n<<64n
            const unsigned = ((value%modulus)+modulus)%modulus
            return info.signed&&unsigned>=(modulus>>1n)?unsigned-modulus:unsigned
        }
        if(typeof value==='bigint'){
            throw new Error(`${kind} does not accept bigint values`)
        }
        if(info.float){
            return info.bytesPerElement===4?Math.fround(value):value
        }
        if(info.clamped){
            const clamped = Math.max(0,Math.min(255,value))
            const lower = Math.floor(clamped)
            const fraction = clamped-lower
            return fraction<0.5?lower:fraction>0.5?lower+1:lower%2===0?lower:lower+1
        }
        const modulus = 2**(info.bytesPerElement*8)
        const unsigned = ((Math.trunc(value)%modulus)+modulus)%modulus
        if(info.signed&&unsigned>=modulus/2){
            return unsigned-modulus
        }
        return unsigned
    })
}

export function encodeTypedArrayBytes(kind:TypedArrayKind,values:TypedArrayValue[]):number[]{
    const info = typedArrayInfo[kind]
    const buffer = new ArrayBuffer(Math.max(1,values.length*info.bytesPerElement))
    const view = new DataView(buffer)
    values.forEach((value,index)=>{
        const offset = index*info.bytesPerElement
        if(info.bigint){
            if(typeof value!=='bigint'){
                throw new Error(`${kind} values must be bigint literals`)
            }
            if(kind==='BigInt64Array'){
                view.setBigInt64(offset,value,true)
            }else{
                view.setBigUint64(offset,value,true)
            }
            return
        }
        if(typeof value!=='number'){
            throw new Error(`${kind} does not accept bigint values`)
        }
        if(kind==='Float32Array'){
            view.setFloat32(offset,value,true)
        }else if(kind==='Float64Array'){
            view.setFloat64(offset,value,true)
        }else if(info.bytesPerElement===1){
            view.setUint8(offset,value)
        }else if(info.bytesPerElement===2){
            info.signed?view.setInt16(offset,value,true):view.setUint16(offset,value,true)
        }else{
            info.signed?view.setInt32(offset,value,true):view.setUint32(offset,value,true)
        }
    })
    return Array.from(new Uint8Array(buffer).slice(0,values.length*info.bytesPerElement))
}

function decodeTypedArrayBytes(kind:TypedArrayKind,bytes:number[]):TypedArrayValue[]{
    const info = typedArrayInfo[kind]
    if(bytes.length%info.bytesPerElement){
        throw new Error(`ArrayBuffer byte length must be a multiple of ${info.bytesPerElement} for ${kind}`)
    }
    const buffer = new Uint8Array(bytes).buffer
    const view = new DataView(buffer)
    const values:TypedArrayValue[] = []
    for(let offset=0;offset<bytes.length;offset+=info.bytesPerElement){
        if(kind==='Float32Array'){
            values.push(view.getFloat32(offset,true))
        }else if(kind==='Float64Array'){
            values.push(view.getFloat64(offset,true))
        }else if(kind==='BigInt64Array'){
            values.push(view.getBigInt64(offset,true))
        }else if(kind==='BigUint64Array'){
            values.push(view.getBigUint64(offset,true))
        }else if(info.bytesPerElement===1){
            values.push(info.signed?view.getInt8(offset):view.getUint8(offset))
        }else if(info.bytesPerElement===2){
            values.push(info.signed?view.getInt16(offset,true):view.getUint16(offset,true))
        }else{
            values.push(info.signed?view.getInt32(offset,true):view.getUint32(offset,true))
        }
    }
    return values
}

function parseNumericValues(text:string):number[]{
    const values = splitTopLevelArrayValues(text)
    if(values.some(value=>! /^[+-]?(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(value))){
        throw new Error('Typed array values must be numeric literals')
    }
    const numbers = values.map(value=>Number(value.replace(/f$/i,'')))
    if(numbers.some(value=>!Number.isFinite(value))){
        throw new Error('Typed array values must be finite numbers')
    }
    return numbers
}

function parseBigIntValues(text:string):bigint[]{
    const values = splitTopLevelArrayValues(text)
    if(values.some(value=>! /^-?(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|\d+)n$/.test(value))){
        throw new Error('BigInt typed array values must be bigint literals')
    }
    return values.map(value=>{
        const negative = value.startsWith('-')
        const literal = value.slice(negative?1:0,-1)
        const magnitude = BigInt(literal)
        return negative?-magnitude:magnitude
    })
}

function parseIntegerArgument(value:string,label:string):number{
    if(!/^\d+$/.test(value)){
        throw new Error(`${label} must be a non-negative integer literal`)
    }
    const number = Number(value)
    if(!Number.isSafeInteger(number)){
        throw new Error(`${label} is outside the supported range`)
    }
    return number
}

function getArrayValues(active:Base,source:string,kind:TypedArrayKind):TypedArrayValue[]|null{
    const arrayLiteral = source.match(/^\[([\s\S]*)\]$/)
    if(arrayLiteral){
        return typedArrayInfo[kind].bigint
            ? parseBigIntValues(arrayLiteral[1])
            : parseNumericValues(arrayLiteral[1])
    }
    const data = active.getData(source)
    if(!data?.isArray){
        return null
    }
    if(data.typedArrayValues){
        return data.typedArrayValues
    }
    if(data.type==='bigint'&&typedArrayInfo[kind].bigint){
        return parseBigIntValues(data.value??'')
    }
    if(data.type!=='number'){
        return null
    }
    const values = splitTopLevelArrayValues(data.value??'')
    if(values.some(value=>! /^[+-]?(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(value))){
        throw new Error(`Typed array source "${source}" must contain numeric literals`)
    }
    return values.map(value=>Number(value.replace(/f$/i,'')))
}

export type TypedArrayInitializer = {
    kind:TypedArrayKind
    values:TypedArrayValue[]
    bytes:number[]
}

export function initializeTypedArray(active:Base,kind:TypedArrayKind,args:string[]):TypedArrayInitializer{
    const info = typedArrayInfo[kind]
    if(args.length>3){
        throw new Error(`${kind} constructor accepts at most three arguments`)
    }
    const source = args[0]?.trim()??''
    let values:TypedArrayValue[]
    if(!source){
        values = []
    }else if(/^\d+$/.test(source)){
        const length = parseIntegerArgument(source,'Typed array length')
        values = Array(length).fill(info.bigint?0n:0)
    }else{
        const bufferSource = source.match(/^([a-z_$][\w$]*)\.buffer$/i)
        const sourceData = bufferSource?active.getData(bufferSource[1]):null
        if(bufferSource){
            if(!sourceData?.typedArrayKind||!sourceData.typedArrayValues){
                throw new Error(`"${bufferSource[1]}.buffer" is not a supported typed array buffer`)
            }
            const sourceBytes = sourceData.typedArrayBytes
                ??encodeTypedArrayBytes(sourceData.typedArrayKind,sourceData.typedArrayValues)
            const byteOffset = args[1]?parseIntegerArgument(args[1].trim(),'ArrayBuffer byte offset'):0
            if(byteOffset%info.bytesPerElement){
                throw new Error(`ArrayBuffer byte offset must be aligned to ${info.bytesPerElement} bytes for ${kind}`)
            }
            if(byteOffset>sourceBytes.length){
                throw new Error('ArrayBuffer byte offset is outside the source buffer')
            }
            const availableBytes = sourceBytes.length-byteOffset
            const byteLength = args[2]
                ? parseIntegerArgument(args[2].trim(),'Typed array length')*info.bytesPerElement
                : availableBytes
            if(byteLength>availableBytes){
                throw new Error('Typed array view exceeds the source buffer')
            }
            values = decodeTypedArrayBytes(kind,sourceBytes.slice(byteOffset,byteOffset+byteLength))
        }else{
            const arrayValues = getArrayValues(active,source,kind)
            if(!arrayValues){
                throw new Error(`${kind} constructor expects a numeric array, typed array, ArrayBuffer, or length`)
            }
            values = arrayValues
        }
    }
    values = convertTypedArrayValues(kind,values)
    return {kind,values,bytes:encodeTypedArrayBytes(kind,values)}
}
