import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'

export class Data extends Base{
    kind:string|null = null
    name:string|null = null
    type:string|null = null
    value:string|null = null
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        let tokens:string[] = []
        let token:any
        while(!['\n','\;'].includes(token = tokenizer.get())){
            console.log('REC::', token)
            tokens.push(token)
        }
        const [kind,name,sep,type,eq,value] = tokens
        this.kind = kind
        this.name = name
        this.type = type
        this.value = value
    }
}

export default Data