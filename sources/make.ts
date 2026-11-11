import Tokenizer from "./tokenizer.ts"
import Base from "./elements/base.ts"

import Data from "./elements/data.ts"
import Invoke from "./elements/invoke.ts"
import Declare from "./elements/declare.ts"

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
                this.active.children.push(data)
            }
            if(['printf'].includes(token)){
                tokenizer.move(-1)
                console.log('INVOKE')
                const invoke = new Invoke(this.active)
                invoke.set(tokenizer)
                this.active.children.push(invoke)
            }
            if(['declare'].includes(token)){
                tokenizer.move(-1)
                console.log('DECLARE')
                const declare = new Declare(this.active)
                declare.set(tokenizer)
                this.active.children.push(declare)
            }
        }
    }
    asm(){
        this.root.asm()
    }
}

export default Make