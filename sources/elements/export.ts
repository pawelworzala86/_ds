import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'

export class Export extends Base{
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        let tokens:string[] = []
        let token:any
        let index:number = 0
        index = tokenizer.index
        while(!['\n'].includes(token = tokenizer.get())){
            tokens.push(token)
        }
        tokenizer.index = index+1
        let name:string|null = null
        if(['let','var','const'].includes(tokens[1])){
            name = tokens[2]
        }
        this.parent!.addExport(name!)
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(['export'].includes(token)){
            tokenizer.move(-1)
            const data = new Export(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Export