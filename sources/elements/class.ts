import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Make from './../make.ts'
import Asm from "./../asm.ts"
import ClassElement from './clasElement.ts'
import Func from './func.ts'

export class Class extends Base{
    element:ClassElement|null = null
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer,ASM:Asm){
        let tokens:string[] = tokenizer.getBlock()
        const name = tokens[1]
        const bodyStart = tokens.indexOf('{')
        const bodyEnd = tokens.lastIndexOf('}')
        if(bodyStart===-1||bodyEnd===-1){
            throw new Error(`Class "${name}" is missing a body`)
        }
        tokens = tokens.slice(bodyStart+1,bodyEnd)
        const tokenizer2 = new Tokenizer('')
        tokenizer2.tokens = tokens
        Make.compile(ASM,this,tokenizer2,null)

        const element:ClassElement = new ClassElement(name,this.DATA,this.FUNCTIONS)
        this.element = element
        this.parent!.addClass(element)
    }
    asm(ASM:Asm){
        const props = this.DATA.map(prop=>{
            const type = prop.type=='string'?'db':'dq'
            const value = prop.type=='string'?`'${prop.value}',0`:prop.value
            return `    ${prop.name} ${type} ${value}`
        })
        const methods = this.children
            .filter((child):child is Func=>child instanceof Func)
            .map(method=>method.getStructCode(ASM))
        ASM.addCode([`struct ${this.element!.name}`,...props,...methods,'end struct'].join('\n'))
    }
    testChangeName(){
        for(const child of this.children){
            child.testChangeName()
        }
    }
    static test(active:Base,tokenizer:Tokenizer,ASM:Asm){
        const token = tokenizer.get()
        if(['class'].includes(token)){
            tokenizer.move(-1)
            const data = new Class(active)
            data.set(tokenizer,ASM)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Class