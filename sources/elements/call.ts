import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import { FuncElement } from './func.ts'
import Asm from "./../asm.ts"
import Link from './link.ts'

export class Call extends Base{
    func:FuncElement|null = null
    params:any[] = []
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
        const func:FuncElement = this.getFunction(tokens[0])
        tokens.splice(0,2)
        this.func = func
        this.params = tokens.map((token)=>{
            return Link.data(this,token)
        })
    }
    asm(ASM:Asm){
        console.log('CALL FUNCTION')
        const params = this.params.map((param:any)=>{
            if(typeof param=='object'){
                return param.getCode()
            }
            return param
        }).join(', ')
        const code = `rvcall ${this.func!.name} ${params}`
        ASM.addCode(code)
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        //console.log(active.FUNCTIONS)
        //console.log('active.getFunction(token)',active.getFunction(token),token)
        if(active.getFunction(token)){
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