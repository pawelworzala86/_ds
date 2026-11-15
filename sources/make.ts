import Tokenizer from "./tokenizer.ts"
import Asm from "./asm.ts"
import Base from "./elements/base.ts"

import Data from "./elements/data.ts"
import Assign from "./elements/assign.ts"
import Invoke from "./elements/invoke.ts"
import Declare from "./elements/declare.ts"
import Func from "./elements/func.ts"
import Call from "./elements/call.ts"
import Import from "./elements/import.ts"
import Export from "./elements/export.ts"
import Class from "./elements/class.ts"
import Prototype from "./elements/prototype.ts"
import Iff from "./elements/iff.ts"
import While from "./elements/while.ts"
import Break from "./elements/break.ts"
import Return from "./elements/return.ts"

export class Make{
    constructor(){
    }
    static compile(ASM:Asm,active:Base,tokenizer:Tokenizer,filePath:string|null=null){
        Func.predeclare(active,tokenizer)
        while(tokenizer.has()){
            if(Data.test(active,tokenizer,active instanceof Class)){
            }else if(Assign.test(active,tokenizer)){
            }else if(Declare.test(active,tokenizer)){
            }else if(Invoke.test(active,tokenizer)){
            }else if(Func.test(active,tokenizer,ASM,active instanceof Class)){
            }else if(Call.test(active,tokenizer)){
            }else if(Import.test(active,tokenizer,filePath,ASM)){
            }else if(Export.test(active,tokenizer)){
            }else if(Class.test(active,tokenizer,ASM)){
            }else if(Prototype.test(active,tokenizer,ASM)){
            }else if(Iff.test(active,tokenizer)){
            }else if(While.test(active,tokenizer)){
            }else if(Break.test(active,tokenizer)){
            }else if(Return.test(active,tokenizer)){
            }else{
                const token = tokenizer.get()
                ASM.addCodeNLN(token+' ')
            }
        }
        active.prepareFunctionCalls()
        //console.log('ACTIVE::',active.EXPORT)
        active.linkExports()
    }
}

export default Make