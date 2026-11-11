import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import ASM from './../asm.ts'
import {getData} from './data.ts'

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
        const params = this.params.map(param=>{
            const data = getData(param)
            if(data&&(data.type=='string')){
                return 'addr ' + param
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