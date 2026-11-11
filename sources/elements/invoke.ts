import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'

const Invokers = []

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
            console.log('REC::', token)
            tokens.push(token)
        }
        const [name] = tokens
        tokens.splice(0,2)
        this.name = name
        this.params = tokens
    }
    asm(){
        console.log('INVOKE CALL')
    }
}

export default Invoke