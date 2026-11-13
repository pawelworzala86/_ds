import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Make from './../make.ts'
import Asm from "./../asm.ts"

const Funcs:any = []

export function setFunction(name:string){
    Funcs.push(name)
}

export function getFuncs(){
    return Funcs
}

export class Func extends Base{
    name:string|null = null
    params:string[] = []
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        let tokens:string[] = tokenizer.getBlock()
        console.log(tokens)
        const [fn,name] = tokens
        tokens.splice(0,2)
        this.name = name

        this.params = Tokenizer.getParams(tokens)

        const tokenizer2 = new Tokenizer('')
        tokenizer2.tokens = tokens
        Make.compile(this,tokenizer2)

        setFunction(name)
    }
    asm(ASM:Asm){
        console.log('FUNCTION')
        const asm = new Asm()
        asm.addCode(`proc ${this.name}`)
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
            //console.log('Declare')
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