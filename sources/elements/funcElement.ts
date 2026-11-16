export class FuncElement{
    name:string|null = null
    params:{name:string,type:string,dynamicArray?:boolean}[] = []
    nativeCallbackName:string|null = null
    isAsync = false
    asyncWorkerName:string|null = null
    constructor(name:string,params:{name:string,type:string,dynamicArray?:boolean}[],isAsync=false,asyncWorkerName:string|null=null){
        this.name = name
        this.params = params
        this.isAsync = isAsync
        this.asyncWorkerName = asyncWorkerName
    }
    getCode(){
        return this.name
    }
}

export default FuncElement