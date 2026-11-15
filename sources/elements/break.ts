import Tokenizer from '../tokenizer.ts'
import Asm from '../asm.ts'
import Base from './base.ts'
import While from './while.ts'

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
        let parent:Base|null = active
        while(parent&&!(parent instanceof While)){
            parent = parent.parent
        }
        if(!(parent instanceof While)){
            throw new Error('Break statement is only valid inside a while loop')
        }
        const statement = new Break(active,parent.endLabel)
        active.children.push(statement)
        return statement
    }
}

export default Break
