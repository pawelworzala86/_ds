import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import ASM from './../asm.ts'

export class Func extends Base{
    name:string|null = null
    //params:string[] = []
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        let tokens:string[] = tokenizer.getBlock()
        console.log(tokens)
        const [name] = tokens
        tokens.splice(0,2)
        this.name = name
        //this.params = tokens
        //process.exit()
    }
    asm(){
        console.log('FUNCTION')
        const code = `FUNCTION`
        //ASM.addCode(code)
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