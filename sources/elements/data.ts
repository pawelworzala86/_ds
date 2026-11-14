import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import DataElement from './dataElement.ts'

export class Data extends Base{
    element:DataElement|null = null
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer,classField=false){
        let tokens:string[] = []
        let token:any
        while(!['\n','\;'].includes(token = tokenizer.get())){
            tokens.push(token)
        }
        let [kind,name,sep,type,eq,value] = tokens
        if(classField){
            kind = 'let'
            ;[name,sep,type,eq,value] = tokens
        }
        const classType = this.parent?.getClass(type)
        if(classType&&eq==='='&&(value!=='new'||tokens[6]!==type)){
            throw new Error(`Class instance "${name}" must be initialized with new ${type}()`)
        }
        let values = [value]
        if(type=='string'){
            let open = false
            let spec = false
            values = []
            for(const token of tokens){
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
        this.element = new DataElement(kind,name,type,values.join(' ')??'')
        this.element.classType = classType?.name??null
        this.parent?.addData(this.element)
    }
    asm(ASM:Asm){
        if(this.element!.classType){
            ASM.addData(`${this.element!.name} ${this.element!.classType}`)
            return
        }
        let type = 'dq'
        let value = this.element!.value
        if(this.element!.type=='string'){
            type = 'db'
            value = '\''+value+'\',0'
        }
        const data:string = `${this.element!.name} ${type} ${value}`
        ASM.addData(data)
    }
    static test(active:Base,tokenizer:Tokenizer,classField=false){
        const token = tokenizer.get()
        const next = tokenizer.get()
        tokenizer.move(-2)
        const isClassField = classField&&next===':'
        if(['let','var','const'].includes(token)||isClassField){
            const data = new Data(active)
            data.set(tokenizer,isClassField)
            active.children.push(data)
            return data
        }
        return null
    }
}

export default Data