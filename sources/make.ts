import Tokenizer from "./tokenizer.ts"
import Base from "./elements/base.ts"

import Data from "./elements/data.ts"
import Invoke from "./elements/invoke.ts"
import Declare from "./elements/declare.ts"
import Func from "./elements/func.ts"
import Call from "./elements/call.ts"

export class Make{
    constructor(){
    }
    static compile(active:Base,tokenizer:Tokenizer){
        while(tokenizer.has()){
            if(Data.test(active,tokenizer)){
            }else if(Declare.test(active,tokenizer)){
            }else if(Invoke.test(active,tokenizer)){
            }else if(Func.test(active,tokenizer)){
            }else if(Call.test(active,tokenizer)){
            }else{
                tokenizer.get()
            }
        }
    }
}

export default Make