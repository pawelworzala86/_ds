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
    numericKind:NumericKind = 'integer'
    isArray = false
    dynamicArray = false
    isParameter = false
    isProcedureLocal = false
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
        if(this.type=='string'){
            return 'addr '+this.name
        }
        if(byValue&&this.type=='number'){
            return '['+this.name+']'
        }
        return this.name
    }
}

export default DataElement