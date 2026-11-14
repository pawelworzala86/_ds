import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Make from './../make.ts'
import Asm from "./../asm.ts"
import FuncElement from './funcElement.ts'

export class Func extends Base{
    element:FuncElement|null = null
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        let tokens:string[] = tokenizer.getBlock()
        const [fn,name] = tokens
        tokens.splice(0,2)

        const params = Tokenizer.getParams(tokens)

        const tokenizer2 = new Tokenizer('')
        tokenizer2.tokens = tokens
        Make.compile(this,tokenizer2)

        const element:FuncElement = new FuncElement(name,params)
        this.element = element
        this.parent!.addFunction(element)
    }
    asm(ASM:Asm){
        const asm = new Asm()
        asm.addCode(`proc ${this.element!.name}`)
        for(const node of this.children){
            node.asm(asm)
        }
        asm.addCode(`endp`)
        const code = asm.getCode().join('\n')
        ASM.addProc(code)
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(['function'].includes(token)){
            tokenizer.move(-1)
            const data = new Func(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Func