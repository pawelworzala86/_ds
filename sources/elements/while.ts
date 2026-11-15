import Tokenizer from '../tokenizer.ts'
import Asm from '../asm.ts'
import Make from '../make.ts'
import Base from './base.ts'
import Iff from './iff.ts'

let whileId = 0

export class While extends Iff{
    startLabel = `__ds_while_start_${++whileId}`
    bodyLabel = `__ds_while_body_${whileId}`
    endLabel = `__ds_while_end_${whileId}`

    set(tokenizer:Tokenizer){
        if(tokenizer.get()!=='while'||tokenizer.get()!=='('){
            throw new Error('Invalid while statement')
        }
        const conditionTokens = tokenizer.getCallArguments()
        if(conditionTokens.length!==1){
            throw new Error('While condition must be a single expression')
        }
        this.condition = this.parseCondition(conditionTokens[0])

        let next = tokenizer.get()
        while(next==='\n'){
            next = tokenizer.get()
        }
        if(next!=='{'){
            throw new Error('Expected "{" after while condition')
        }
        tokenizer.move(-1)
        this.thenBranch = this.compileBranch(tokenizer.getBlock())
    }

    asm(ASM:Asm){
        if(!this.condition||!this.thenBranch){
            throw new Error('While statement is not initialized')
        }
        ASM.addCode(`${this.startLabel}:`)
        this.emitBranch(this.condition,ASM,this.bodyLabel,this.endLabel)
        ASM.addCode(`${this.bodyLabel}:`)
        this.thenBranch.asm(ASM)
        ASM.addCode(`jmp ${this.startLabel}`)
        ASM.addCode(`${this.endLabel}:`)
    }

    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(token==='while'){
            tokenizer.move(-1)
            const statement = new While(active)
            statement.set(tokenizer)
            active.children.push(statement)
            return statement
        }
        tokenizer.move(-1)
        return null
    }
}

export default While
