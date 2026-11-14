export class FuncElement{
    name:string|null = null
    params:string[] = []
    constructor(name:string,params:string[]){
        this.name = name
        this.params = params
    }
    getCode(){
        return this.name
    }
}

export default FuncElement