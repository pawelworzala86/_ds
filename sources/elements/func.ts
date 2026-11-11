import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Make from './../make.ts'

export class Func extends Base{
    name:string|null = null
    params:string[] = []
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        let tokens:string[] = tokenizer.getBlock()
        console.log(tokens)
        const [name] = tokens
        tokens.splice(0,2)
        this.name = name
        this.params = []

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
        console.log('FNC BLOCK',this)
    }
    asm(){
        console.log('FUNCTION')
        //const code = `FUNCTION`
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