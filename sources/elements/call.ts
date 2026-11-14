import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import Link from './link.ts'
import FuncElement from './funcElement.ts'
import DataElement from './dataElement.ts'

export class Call extends Base{
    func:FuncElement|null = null
    params:any[] = []
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
        this.params = tokenizer.getCallArguments().map(token=>Link.data(this,token))
    }
    asm(ASM:Asm){
        const params = this.params.map((param:any)=>{
            if(typeof param=='object'){
                return param.getCode()
            }
            return param
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