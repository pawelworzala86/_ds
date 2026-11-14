export class FuncElement{
    name:string|null = null
    params:{name:string,type:string,dynamicArray?:boolean}[] = []
    constructor(name:string,params:{name:string,type:string,dynamicArray?:boolean}[]){
        this.name = name
        this.params = params
    }
    getCode(){
        return this.name
    }
}

export default FuncElement