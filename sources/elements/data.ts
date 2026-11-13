import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"

export class DataElement{
    kind:string|null = null
    name:string|null = null
    type:string|null = null
    value:string|null = null
    constructor(kind:string,name:string,type:string,value:string){
        this.kind = kind
        this.name = name
        this.type = type
        this.value = value
    }
    getCode(){
        if(this.type=='string'){
            return 'addr '+this.name
        }
        return this.name
    }
}

export class Data extends Base{
    element:DataElement|null = null
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
        }
        this.element = new DataElement(kind,name,type,values.join(' '))
        this.parent?.setData(name, this.element)
    }
    asm(ASM:Asm){
        console.log('DATA SETTTER')
        let type = 'dq'
        let value = this.element!.value
        if(this.element!.type=='string'){
            type = 'db'
            value = '\''+value+'\',0'
        }
        const data:string = `${this.element!.name} ${type} ${value}`
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