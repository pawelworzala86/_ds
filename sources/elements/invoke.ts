import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import Link from './link.ts'

const Invokers:any = []

export function setInvoke(name:string){
    Invokers.push(name)
}

export class Invoke extends Base{
    name:string|null = null
    params:any[] = []
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        this.name = tokenizer.get()
        if(tokenizer.get()!=='('){
            throw new Error(`Expected '(' after function "${this.name}"`)
        }
        this.params = tokenizer.getCallArguments().map(token=>Link.data(this,token))
    }
    asm(ASM:Asm){
        const params = this.params.map((param:any)=>{
            if(typeof param=='object'){
                return param.getCode(true)
            }
            return param
        }).join(', ')
        const code = `invoke ${this.name} ${params}`
        ASM.addCode(code)
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(Invokers.includes(token)){
            tokenizer.move(-1)
            const data = new Invoke(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Invoke