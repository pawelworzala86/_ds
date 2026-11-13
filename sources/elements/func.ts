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

        let openP = false
        let params = []
        console.log('TOKENS: ',tokens)
        for(const token of tokens){
            console.log(token)
            if(token=='('){
                openP = true
                continue
            }
            if(token==')'){
                break
            }
            if(openP){
                params.push(token)
            }
        }
        console.log('params',params)

        this.params = params

        let open = false
        let values = []
        console.log('TOKENS: ',tokens)
        for(const token of tokens){
            console.log(token)
            if(token=='{'){
                open = true
                continue
            }
            if(open){
                values.push(token)
            }
        }
        values.splice(-1)
        console.log('values',values)
        //process.exit()

        const tokenizer2 = new Tokenizer('')
        tokenizer2.tokens = tokens
        Make.compile(this,tokenizer2)
        //console.log('FNC BLOCK',this)

        setFunction(name)
    }
    asm(ASM:Asm){
        console.log('FUNCTION')
        ASM.addCode(`proc ${this.name}`)
        for(const node of this.children){
            node.asm(ASM)
        }
        ASM.addCode(`endp`)
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