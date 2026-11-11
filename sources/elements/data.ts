import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'

export class Data extends Base{
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        const token = tokenizer.get()
        console.log('TOKEN::',token)
    }
}

export default Data