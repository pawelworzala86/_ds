import Tokenizer from "./tokenizer.ts"
import Base from "./elements/base.ts"

import Data from "./elements/data.ts"
import Invoke from "./elements/invoke.ts"
import Declare from "./elements/declare.ts"
import Func from "./elements/func.ts"

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
        const {tokenizer,active} = this
        while(tokenizer.has()){
            if(Data.test(active,tokenizer)){
            }else if(Declare.test(active,tokenizer)){
            }else if(Invoke.test(active,tokenizer)){
            }else if(Func.test(active,tokenizer)){
            }else{
                tokenizer.get()
            }
        }
    }
    asm(){
        this.root.asm()
    }
}

export default Make