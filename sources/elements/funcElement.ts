export class FuncElement{
    name:string|null = null
    params:{name:string,type:string,dynamicArray?:boolean,defaultValue?:string}[] = []
    nativeCallbackName:string|null = null
    isAsync = false
    asyncWorkerName:string|null = null
    returnArrayType:string|null = null
    returnArrayNumericKind:'integer'|'float' = 'integer'
    returnClassType:string|null = null
    returnThis = false
    returnType:string|null = null
    constructor(name:string,params:{name:string,type:string,dynamicArray?:boolean,defaultValue?:string}[],isAsync=false,asyncWorkerName:string|null=null){
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