import Asm from '../asm.ts'
import Base from './base.ts'
import {emitExpression, parseExpression, type Expression} from './assign.ts'
import DataElement from './dataElement.ts'
import FuncElement from './funcElement.ts'
import Link from './link.ts'

let argumentId = 0

export class FunctionArgument{
    value:ReturnType<typeof Link.data>
    expression:Expression|null = null
    tempName:string|null = null

    constructor(active:Base,text:string){
        this.value = Link.data(active,text)
        if(!/^['"]/.test(text)&&/\*\*|[+\-*/%]/.test(text)){
            this.expression = parseExpression(text,active)
            this.tempName = `__ds_call_arg_${++argumentId}`
        }
    }

    asm(ASM:Asm){
        if(!this.expression||!this.tempName){
            return
        }
        emitExpression(this.expression,ASM)
        ASM.addData(`${this.tempName} dq 0`)
        ASM.addCode(this.expression.numericKind==='float'
            ? `movsd qword [${this.tempName}], xmm0`
            : `mov [${this.tempName}], rax`)
    }

    getCode(byValue=false){
        if(this.tempName){
            return byValue?`[${this.tempName}]`:this.tempName
        }
        if(this.value instanceof DataElement){
            return this.value.getCode(byValue)
        }
        if(this.value instanceof FuncElement){
            return this.value.getCode()
        }
        return this.value
    }
}

export default FunctionArgument
