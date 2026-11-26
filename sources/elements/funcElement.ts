export class FuncElement{
    name:string|null = null
    params:{name:string,type:string,declaredType?:string|null,numericKind?:'integer'|'float',dynamicArray?:boolean,defaultValue?:string,variadic?:boolean}[] = []
    nativeCallbackName:string|null = null
    isAsync = false
    asyncWorkerName:string|null = null
    returnArrayType:string|null = null
    returnArrayNumericKind:'integer'|'float' = 'integer'
    returnClassType:string|null = null
    returnThis = false
    returnType:string|null = null
    constructor(name:string,params:{name:string,type:string,declaredType?:string|null,numericKind?:'integer'|'float',dynamicArray?:boolean,defaultValue?:string,variadic?:boolean}[],isAsync=false,asyncWorkerName:string|null=null){
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