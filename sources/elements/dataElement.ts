import type {TypedArrayKind,TypedArrayValue} from './data/typedArrays.ts'

export type NumericKind = 'integer'|'float'
export type JsonValue = string|number|boolean|null|JsonValue[]|{[key:string]:JsonValue}

export function getNumericKind(value:string):NumericKind{
    if(/^[+-]?(?:0x[0-9a-f]+|[0-9a-f]+h)$/i.test(value)){
        return 'integer'
    }
    return /^[+-]?(?:(?:\d+\.\d*|\.\d+)(?:e[+-]?\d+)?|\d+e[+-]?\d+|\d+f)$/i.test(value)?'float':'integer'
}

export class DataElement{
    kind:string|null = null
    name:string|null = null
    type:string|null = null
    declaredType:string|null = null
    value:string|null = null
    classType:string|null = null
    classLayoutType:string|null = null
    classLayoutProps:DataElement[]|null = null
    arrayObjectValues:DataElement[][]|null = null
    arrayElementTypes = new Map<number,{type:string,classType:string|null,numericKind:NumericKind}>()
    arrayLength:number|null = null
    arrayHasMutation = false
    typedArrayKind:TypedArrayKind|null = null
    typedArrayValues:TypedArrayValue[]|null = null
    typedArrayBytes:number[]|null = null
    jsonValue:JsonValue|undefined
    classPropertyInstance:DataElement|null = null
    classPropertyPath:string|null = null
    timeoutLockName:string|null = null
    timeoutCompletedName:string|null = null
    numericKind:NumericKind = 'integer'
    isArray = false
    dynamicArray = false
    isParameter = false
    isProcedureLocal = false
    isHeapAllocated = false
    isReferenceAlias = false
    isReturnedArray = false
    isConstAlias = false
    isExportedConstAlias = false
    classPropertyOffset:number|null = null
    constructor(kind:string,name:string,type:string,value:string){
        this.kind = kind
        this.name = name
        this.type = type
        this.value = value
        if(type==='number'){
            this.numericKind = getNumericKind(value)
        }
    }
    getCode(byValue=false){
        if(this.isConstAlias){
            return this.name
        }
        if(this.isArray){
            return this.isParameter?this.name:'addr '+this.name
        }
        if(this.isReferenceAlias&&this.type==='string'){
            return byValue?`[${this.name}]`:this.name
        }
        if(this.classType&&this.isProcedureLocal){
            return this.isHeapAllocated?`[${this.name}]`:'addr '+this.name
        }
        if(this.type=='string'){
            return this.isParameter?this.name:`[${this.name}]`
        }
        if(byValue&&this.type==='ArrayBuffer'){
            return this.isParameter?this.name:`[${this.name}]`
        }
        if(byValue&&(this.type=='number'||this.type==='boolean')){
            return '['+this.name+']'
        }
        return this.name
    }
    getAccessName(){
        return this.classPropertyInstance&&this.classPropertyPath
            ? (this.classPropertyInstance.isProcedureLocal||this.classPropertyInstance.isReferenceAlias)
                &&this.classPropertyOffset!==null
                ? `${this.classPropertyInstance.name}+${this.classPropertyOffset}`
                : `${this.classPropertyInstance.name}.${this.classPropertyPath}`
            : this.name
    }
}

export default DataElement