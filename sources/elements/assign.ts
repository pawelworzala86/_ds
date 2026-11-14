import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from './../asm.ts'
import DataElement from './dataElement.ts'
import {emitExpression, parseExpression, type Expression} from '../maths.ts'

export class Assign extends Base{
    target:DataElement|null = null
    expression:Expression|null = null
    constructor(parent:Base){
        super(parent)
    }
    setExpression(target:DataElement,expression:string,initializer=false){
        if(!initializer&&target.kind==='const'){
            throw new Error(`Cannot assign to constant "${target.name}"`)
        }
        if(target.type!=='number'){
            throw new Error('Assignment is only supported for number variables')
        }
        this.target = target
        this.expression = parseExpression(expression,this.parent!)
        target.numericKind = target.numericKind==='float'||this.expression.numericKind==='float'
            ? 'float'
            : 'integer'
    }
    set(tokenizer:Tokenizer){
        const tokens:string[] = []
        let token:string
        while(!['\n',';'].includes(token = tokenizer.get())){
            tokens.push(token)
        }
        const statement = tokens.join('').replace(/;$/,'')
        const match = statement.match(/^([a-z_$][\w.$]*)=(.+?);?$/i)
        if(!match){
            throw new Error('Invalid assignment')
        }
        const [,targetName,expression] = match
        const target = this.parent?.getData(targetName)
        if(!target){
            throw new Error(`Unknown assignment target "${targetName}"`)
        }
        this.setExpression(target,expression)
    }
    asm(ASM:Asm){
        if(!this.target||!this.expression){
            throw new Error('Assignment is not initialized')
        }
        emitExpression(this.expression,ASM)
        if(this.expression.numericKind==='float'){
            ASM.addCode(`movsd qword [${this.target.name}], xmm0`)
        }else if(this.target.numericKind==='float'){
            ASM.addCode('cvtsi2sd xmm0, rax')
            ASM.addCode(`movsd qword [${this.target.name}], xmm0`)
        }else{
            ASM.addCode(`mov [${this.target.name}], rax`)
        }
    }
    static test(active:Base,tokenizer:Tokenizer){
        const first = tokenizer.get()
        const second = tokenizer.get()
        tokenizer.move(-2)
        const compactAssignment = first.match(/^([a-z_$][\w.$]*)=/i)
        const targetName = second==='='
            ? first
            : compactAssignment?.[1]
        if(targetName&&active.getData(targetName)){
            const data = new Assign(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        return null
    }
}

export default Assign
