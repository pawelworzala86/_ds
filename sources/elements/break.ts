import Tokenizer from '../tokenizer.ts'
import Asm from '../asm.ts'
import Base from './base.ts'

export class Break extends Base{
    target:string

    constructor(parent:Base,target:string){
        super(parent)
        this.target = target
    }

    asm(ASM:Asm){
        ASM.addCode(`jmp ${this.target}`)
    }

    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(token!=='break'&&token!=='break;'){
            tokenizer.move(-1)
            return null
        }
        if(token==='break'&&tokenizer.tokens[tokenizer.index]===';'){
            tokenizer.index++
        }
        let parent:Base|null = active
        while(parent&&!parent.breakLabel){
            parent = parent.parent
        }
        if(!parent?.breakLabel){
            throw new Error('Break statement is only valid inside a loop or switch')
        }
        const statement = new Break(active,parent.breakLabel)
        active.children.push(statement)
        return statement
    }
}

export default Break
