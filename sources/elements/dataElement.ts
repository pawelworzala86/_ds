export class DataElement{
    kind:string|null = null
    name:string|null = null
    type:string|null = null
    value:string|null = null
    constructor(kind:string,name:string,type:string,value:string){
        this.kind = kind
        this.name = name
        this.type = type
        this.value = value
    }
    getCode(){
        if(this.type=='string'){
            return 'addr '+this.name
        }
        return this.name
    }
}

export default DataElement