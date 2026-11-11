import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import ASM from './../asm.ts'

const Invokers:any = []

export function setInvoke(name:string){
    Invokers.push(name)
}

export class Invoke extends Base{
    name:string|null = null
    params:string[] = []
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        let tokens:string[] = []
        let token:any
        while(![')'].includes(token = tokenizer.get())){
            //console.log('REC::', token)
            tokens.push(token)
        }
        const [name] = tokens
        tokens.splice(0,2)
        this.name = name
        this.params = tokens
    }
    asm(){
        console.log('INVOKE CALL')
        const code = `invoke ${this.name} addr ${this.params.join(', ')}`
        ASM.addCode(code)
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(Invokers.includes(token)){
            tokenizer.move(-1)
            //console.log('Declare')
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