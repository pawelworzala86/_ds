export type NumericKind = 'integer'|'float'

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
    value:string|null = null
    classType:string|null = null
    classLayoutType:string|null = null
    classLayoutProps:DataElement[]|null = null
    classPropertyInstance:DataElement|null = null
    classPropertyPath:string|null = null
    numericKind:NumericKind = 'integer'
    isArray = false
    dynamicArray = false
    isParameter = false
    isProcedureLocal = false
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
        if(this.isArray){
            return this.isParameter?this.name:'addr '+this.name
        }
        if(this.classType&&this.isProcedureLocal){
            return 'addr '+this.name
        }
        if(this.type=='string'){
            return 'addr '+this.name
        }
        if(byValue&&this.type=='number'){
            return '['+this.name+']'
        }
        return this.name
    }
    getAccessName(){
        return this.classPropertyInstance&&this.classPropertyPath
            ? this.classPropertyInstance.isProcedureLocal&&this.classPropertyOffset!==null
                ? `${this.classPropertyInstance.name}+${this.classPropertyOffset}`
                : `${this.classPropertyInstance.name}.${this.classPropertyPath}`
            : this.name
    }
}

export default DataElement