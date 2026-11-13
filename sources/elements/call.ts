import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import {getFuncs} from './func.ts'
import Asm from "./../asm.ts"

export class Call extends Base{
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
    asm(ASM:Asm){
        console.log('CALL FUNCTION')
        const params = this.params.map(param=>{
            const data = this.getData(param)
            if(data&&(data.type=='string')){
                return 'addr ' + param
            }
            return param
        }).join(', ')
        const code = `rvcall ${this.name} ${params}`
        ASM.addCode(code)
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        console.log('Call',getFuncs())
        if(getFuncs().includes(token)){
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