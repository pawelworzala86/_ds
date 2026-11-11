import Tokenizer from "../tokenizer.ts"

export class Base{
    parent:Base|null
    children:Base[] = []
    constructor(parent:Base|null){
        this.parent = parent
    }
    set(tokenizer:Tokenizer){}
    asm(){
        for(const child of this.children){
            child.asm()
        }
    }
}

export default Base