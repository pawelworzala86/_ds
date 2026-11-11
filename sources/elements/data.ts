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
            //console.log('REC::', token)
            tokens.push(token)
        }
        const [kind,name,sep,type,eq,value] = tokens
        this.kind = kind
        this.name = name
        this.type = type
        this.value = value
    }
    asm(){
        console.log('DATA SETTTER')
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(['let','var','const'].includes(token)){
            tokenizer.move(-1)
            ///console.log('DATASET')
            const data = new Data(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Data