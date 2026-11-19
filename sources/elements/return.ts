import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from '../asm.ts'
import {emitExpression,parseExpression,type Expression} from '../maths.ts'
import Iff from './iff.ts'
import Call from './call.ts'
import Invoke,{isInvoke} from './invoke.ts'

let returnConditionId = 0

export class Return extends Base{
    expression:Expression|null = null
    condition:Iff|null = null
    call:Call|Invoke|null = null

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
            if(Iff.isConditionExpression(expression)){
                this.condition = new Iff(this)
                this.condition.condition = this.condition.parseCondition(expression)
            }else{
                const callTokenizer = new Tokenizer(expression)
                const name = callTokenizer.get()
                const opening = callTokenizer.get()
                if(/^[a-z_$][\w$]*$/i.test(name??'')&&opening==='('){
                    callTokenizer.move(-2)
                    const call = isInvoke(name)
                        ? new Invoke(this)
                        : new Call(this)
                    call.set(callTokenizer)
                    if(!callTokenizer.has()){
                        this.call = call
                    }
                }
                if(!this.call){
                    this.expression = parseExpression(expression,this)
                }
            }
        }
    }

    asm(ASM:Asm){
        if(this.condition?.condition){
            const id = ++returnConditionId
            const trueLabel = `__ds_return_true_${id}`
            const falseLabel = `__ds_return_false_${id}`
            const endLabel = `__ds_return_end_${id}`
            this.condition.emitBranch(this.condition.condition,ASM,trueLabel,falseLabel)
            ASM.addCode(`${trueLabel}:`)
            ASM.addCode('mov rax, 1')
            ASM.addCode(`jmp ${endLabel}`)
            ASM.addCode(`${falseLabel}:`)
            ASM.addCode('xor rax, rax')
            ASM.addCode(`${endLabel}:`)
        }else if(this.call){
            this.call.asm(ASM)
        }else if(this.expression){
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
