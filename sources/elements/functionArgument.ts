import Asm from '../asm.ts'
import Base from './base.ts'
import {emitExpression, parseExpression, type Expression} from '../maths.ts'
import DataElement from './dataElement.ts'
import FuncElement from './funcElement.ts'
import Link from './link.ts'

let argumentId = 0

export class FunctionArgument{
    value:ReturnType<typeof Link.data>
    expression:Expression|null = null
    tempName:string|null = null
    arrayPointerName:string|null = null

    constructor(active:Base,text:string){
        this.value = Link.data(active,text)
        if(this.value instanceof DataElement&&this.value.isArray&&this.value.isParameter){
            this.arrayPointerName = `__ds_call_array_${++argumentId}`
        }
        if(this.value instanceof DataElement&&this.value.isParameter&&!this.value.isArray){
            this.tempName = `__ds_call_arg_${++argumentId}`
        }else if(!/^['"]/.test(text)&&(/\*\*|[+\-*/%]/.test(text)||/\[[^\]]+\]/.test(text)||/^(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(text))){
            this.expression = parseExpression(text,active)
            this.tempName = `__ds_call_arg_${++argumentId}`
        }
    }

    asm(ASM:Asm){
        if(this.arrayPointerName&&this.value instanceof DataElement){
            ASM.addData(`${this.arrayPointerName} dq 0`)
            ASM.addCode(`mov rax, ${this.value.name}`)
            ASM.addCode(`mov [${this.arrayPointerName}], rax`)
        }
        if(this.tempName&&this.value instanceof DataElement&&this.value.isParameter&&!this.expression){
            ASM.addData(`${this.tempName} dq 0`)
            ASM.addCode(`mov rax, ${this.value.name}`)
            ASM.addCode(`mov [${this.tempName}], rax`)
            return
        }
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
        if(this.arrayPointerName){
            return this.arrayPointerName
        }
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
