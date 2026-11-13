import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import {setInvoke} from './invoke.ts'
import Asm from "./../asm.ts"

export class Declare extends Base{
    name:string|null = null
    dll:string|null = null
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        let tokens:string[] = []
        let token:any
        while(!['\n'].includes(token = tokenizer.get())){
            //console.log('REC::', token)
            tokens.push(token)
        }
        const [def,kind,name] = tokens
        this.name = name
        for(const tok of tokens){
            if(tok.indexOf('any//')>-1){
                const dll = tok.replace('any//','')
                this.dll = dll
            }
        }
        setInvoke(name)
    }
    asm(ASM:Asm){
        console.log('DECLARATION')
        ASM.addImport(this.dll!,this.name!)
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(['declare'].includes(token)){
            tokenizer.move(-1)
            //console.log('Declare')
            const data = new Declare(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Declare