import Tokenizer from "../tokenizer.ts"
import Asm from "./../asm.ts"

export class Base{
    parent:Base|null
    children:Base[] = []
    DATA:any = []
    constructor(parent:Base|null){
        this.parent = parent
    }
    set(tokenizer:Tokenizer){}
    asm(ASM:Asm){
        for(const child of this.children){
            child.asm(ASM)
        }
    }
    getData(name:string):any{
        const data = this.DATA[name]
        if(!data){
            return this.parent?.getData(name)
        }
        return data
    }
    setData(name:string,value:any){
        this.DATA[name] = value
    }
}

export default Base