import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from './../asm.ts'
import DataElement from './dataElement.ts'

export class Assign extends Base{
    target:DataElement|null = null
    source:DataElement|string|null = null
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        const tokens:string[] = []
        let token:string
        while(!['\n',';'].includes(token = tokenizer.get())){
            tokens.push(token)
        }
        const [targetName,operator,sourceName,...extra] = tokens
        if(!targetName||operator!=='='||!sourceName||extra.length){
            throw new Error('Invalid assignment')
        }

        const target = this.parent?.getData(targetName)
        if(!target){
            throw new Error(`Unknown assignment target "${targetName}"`)
        }
        if(target.kind==='const'){
            throw new Error(`Cannot assign to constant "${targetName}"`)
        }
        if(target.type!=='number'){
            throw new Error(`Assignment is only supported for number variables`)
        }

        const source = this.parent?.getData(sourceName)
        if(source){
            if(source.type!=='number'){
                throw new Error(`Cannot assign ${source.type} value to number variable "${targetName}"`)
            }
            this.source = source
        }else if(/^-?(?:\d+|0x[0-9a-f]+|[0-9a-f]+h)$/i.test(sourceName)){
            this.source = sourceName
        }else{
            throw new Error(`Unknown assignment value "${sourceName}"`)
        }

        this.target = target
    }
    asm(ASM:Asm){
        if(!this.target||this.source===null){
            throw new Error('Assignment is not initialized')
        }
        const source = this.source instanceof DataElement
            ? `[${this.source.name}]`
            : this.source
        ASM.addCode(`mov rax, ${source}`)
        ASM.addCode(`mov [${this.target.name}], rax`)
    }
    static test(active:Base,tokenizer:Tokenizer){
        const targetName = tokenizer.get()
        const operator = tokenizer.get()
        tokenizer.move(-2)
        if(operator==='='&&active.getData(targetName)){
            const data = new Assign(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        return null
    }
}

export default Assign
