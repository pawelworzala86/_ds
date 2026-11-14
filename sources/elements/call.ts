import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import FuncElement from './funcElement.ts'
import DataElement from './dataElement.ts'
import FunctionArgument from './functionArgument.ts'

export class Call extends Base{
    func:FuncElement|null = null
    params:FunctionArgument[] = []
    methodInstance:DataElement|null = null
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        const name = tokenizer.get()
        if(tokenizer.get()!=='('){
            throw new Error(`Expected '(' after function "${name}"`)
        }
        const method = Call.getMethod(this,name)
        this.func = method?.func??this.getFunction(name)
        this.methodInstance = method?.instance??null
        this.params = tokenizer.getCallArguments().map(token=>new FunctionArgument(this,token))
    }
    asm(ASM:Asm){
        for(const param of this.params){
            param.asm(ASM)
        }
        const params = this.params.map(param=>{
            return param.getCode(this.methodInstance!==null)
        }).join(', ')
        const code = this.methodInstance
            ? `invoke ${this.methodInstance.name}.${this.func!.name} ${params}`
            : `rvcall ${this.func!.name} ${params}`
        ASM.addCode(code)
    }
    static getMethod(active:Base,name:string):{func:FuncElement,instance:DataElement}|null{
        const separator = name.indexOf('.')
        if(separator<1||separator===name.length-1){
            return null
        }
        const instance = active.getData(name.slice(0,separator))
        if(!instance?.classType){
            return null
        }
        const classType = active.getClass(instance.classType)
        const func = classType?.getFunction(name.slice(separator+1))
        return func?{func,instance}:null
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(active.getFunction(token)||Call.getMethod(active,token)){
            tokenizer.move(-1)
            const data = new Call(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Call