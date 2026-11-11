import Tokenizer from "./tokenizer.ts"
import Base from "./elements/base.ts"
import Data from "./elements/data.ts"

export class Make{
    tokenizer:Tokenizer
    root:Base
    active:Base
    constructor(source:string){
        this.tokenizer = new Tokenizer(source)
        this.root = new Base(null)
        this.active = this.root
    }
    compile(){
        const {tokenizer} = this
        while(tokenizer.has()){
            const token = tokenizer.get()
            console.log(token)
            if(['let','var','const'].includes(token)){
                tokenizer.move(-1)
                console.log('DATASET')
                const data = new Data(this.active)
                data.set(tokenizer)
            }
        }
    }
}

export default Make