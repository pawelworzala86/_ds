import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import ASM from './../asm.ts'

const DATA:any = []

export function getData(name:string){
    return DATA[name]
}
export function setData(name:string,value:any){
    DATA[name] = value
}

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
        let values = [value]
        if(type=='string'){
            let open = false
            let spec = false
            values = []
            console.log('TOKENS: ',tokens)
            for(const token of tokens){
                console.log(token)
                if(spec&&(token=='\'')){
                    values.push(token)
                }else if(token=='\''){
                    open = !open
                    continue
                }else if(token=='\\'){
                    spec = true
                    continue
                }
                if(open){
                    values.push(token)
                }
                spec = false
            }
            console.log('values',values)
            this.value = values.join(' ')
        }
        setData(name, {name,type,value:values.join(' ')})
    }
    asm(){
        console.log('DATA SETTTER')
        let type = 'dq'
        let value = this.value
        if(this.type=='string'){
            type = 'db'
            value = '\''+value+'\',0'
        }
        const data:string = `${this.name} ${type} ${value}`
        ASM.addData(data)
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