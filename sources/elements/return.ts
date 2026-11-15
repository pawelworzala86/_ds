import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from '../asm.ts'
import {emitExpression,parseExpression,type Expression} from '../maths.ts'

export class Return extends Base{
    expression:Expression|null = null

    constructor(parent:Base){
        super(parent)
    }

    set(tokenizer:Tokenizer){
        tokenizer.get()
        const tokens:string[] = []
        while(tokenizer.has()){
            const token = tokenizer.get()
            if(token==='\n'||token===';'){
                break
            }
            if(token==='}'){
                tokenizer.move(-1)
                break
            }
            tokens.push(token)
        }
        const expression = tokens.join('').replace(/;$/,'')
        if(expression){
            this.expression = parseExpression(expression,this)
        }
    }

    asm(ASM:Asm){
        if(this.expression){
            emitExpression(this.expression,ASM)
        }
        let parent = this.parent
        while(parent&&!parent.returnLabel){
            parent = parent.parent
        }
        if(!parent?.returnLabel){
            throw new Error('Return statement is only valid inside a function')
        }
        ASM.addCode(`jmp ${parent.returnLabel}`)
    }

    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(token==='return'||token==='return;'){
            tokenizer.move(-1)
            const statement = new Return(active)
            statement.set(tokenizer)
            active.children.push(statement)
            return statement
        }
        tokenizer.move(-1)
        return null
    }
}

export default Return
