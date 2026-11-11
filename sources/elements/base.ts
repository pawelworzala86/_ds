import Tokenizer from "../tokenizer.ts"

export class Base{
    parent:Base|null
    constructor(parent:Base|null){
        this.parent = parent
    }
    set(tokenizer:Tokenizer){}
}

export default Base