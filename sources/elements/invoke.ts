import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import FunctionArgument from './functionArgument.ts'

const Invokers:any = []

export function setInvoke(name:string){
    Invokers.push(name)
}

export function isInvoke(name:string){
    return Invokers.includes(name)
}

export class Invoke extends Base{
    name:string|null = null
    params:FunctionArgument[] = []
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        this.name = tokenizer.get()
        if(tokenizer.get()!=='('){
            throw new Error(`Expected '(' after function "${this.name}"`)
        }
        this.params = tokenizer.getCallArguments().map(token=>new FunctionArgument(this,token))
    }
    asm(ASM:Asm){
        for(const param of this.params){
            param.asm(ASM)
        }
        const params = this.params.map(param=>{
            return param.getCode(true)
        }).join(', ')
        const code = `invoke ${this.name} ${params}`
        ASM.addCode(code)
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        const lineStart = tokenizer.tokens.lastIndexOf('\n',tokenizer.index-2)+1
        const lineComment = tokenizer.tokens[lineStart]?.startsWith(';')??false
        if(Invokers.includes(token)&&tokenizer.tokens[tokenizer.index]==='('&&!lineComment){
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