import Asm from '../../asm.ts'
import {emitExpression, type Expression} from '../../maths.ts'
import DataElement from '../dataElement.ts'
import {stringLiteralData} from '../../stringLiteral.ts'
import {nextLabel} from './ids.ts'
import type {Condition, ConditionCall, StringOperand} from './types.ts'
import type {Iff} from '../iff.ts'

export function isStringOperand(statement:Iff,value:Expression|StringOperand):value is StringOperand{
    if('kind' in value&&value.kind==='literal'){
        return true
    }
    if('kind' in value&&value.kind==='data'){
        return value.value.type==='string'
    }
    return false
}

export function isFloatOperand(statement:Iff,value:Expression|StringOperand){
    return !statement.isStringOperand(value)&&value.numericKind==='float'
}

export function emitCalls(statement:Iff,calls:ConditionCall[],ASM:Asm){
    for(const {call,temp} of calls){
        ASM.addData(`${temp.name} dq 0`)
        call.asm(ASM)
        ASM.addCode(`mov [${temp.name}], rax`)
    }
}

export function emitOperand(statement:Iff,value:Expression|StringOperand,ASM:Asm){
    if(!statement.isStringOperand(value)){
        emitExpression(value,ASM)
        return
    }
    if(value.kind==='literal'){
        const label = nextLabel('string')
        ASM.addData(`${label} ${stringLiteralData(value.value)}`)
        ASM.addCode(`lea rax, [${label}]`)
    }else{
        const data = value.value
        const instance = data.classPropertyInstance
        const offset = data.classPropertyOffset
        if(data.isReferenceAlias){
            ASM.addCode(`mov rdx, [${data.name}]`)
            ASM.addCode('mov rax, [rdx]')
        }else if(data.isParameter&&!instance){
            ASM.addCode(`mov rax, ${data.name}`)
        }else if((instance?.isProcedureLocal||instance?.isReferenceAlias)&&offset!==null){
            ASM.addCode(instance.isHeapAllocated
                ? `mov rdx, [${instance.name}]`
                : `lea rdx, [${instance.name}]`)
            if(offset){
                ASM.addCode(`add rdx, ${offset}`)
            }
            ASM.addCode('mov rax, [rdx]')
        }else{
            ASM.addCode(`mov rax, [${data.getAccessName()}]`)
        }
    }
}

export function emitBranch(statement:Iff,condition:Condition,ASM:Asm,trueLabel:string,falseLabel:string){
    if(condition.kind==='not'){
        statement.emitBranch(condition.value,ASM,falseLabel,trueLabel)
        return
    }
    if(condition.kind==='and'){
        const next = nextLabel('and')
        statement.emitBranch(condition.left,ASM,next,falseLabel)
        ASM.addCode(`${next}:`)
        statement.emitBranch(condition.right,ASM,trueLabel,falseLabel)
        return
    }
    if(condition.kind==='or'){
        const next = nextLabel('or')
        statement.emitBranch(condition.left,ASM,trueLabel,next)
        ASM.addCode(`${next}:`)
        statement.emitBranch(condition.right,ASM,trueLabel,falseLabel)
        return
    }
    if(condition.kind==='boolean'){
        ASM.addCode(`jmp ${condition.value?trueLabel:falseLabel}`)
        return
    }
    if(condition.kind==='truthy'){
        statement.emitCalls(condition.calls,ASM)
        emitExpression(condition.value,ASM)
        if(condition.value.numericKind==='float'){
            ASM.addCode('xorpd xmm1, xmm1')
            ASM.addCode('ucomisd xmm0, xmm1')
            ASM.addCode(`jp ${trueLabel}`)
            ASM.addCode(`jne ${trueLabel}`)
        }else{
            ASM.addCode('test rax, rax')
            ASM.addCode(`jnz ${trueLabel}`)
        }
        ASM.addCode(`jmp ${falseLabel}`)
        return
    }
    statement.emitCalls(condition.calls,ASM)
    if(statement.isStringOperand(condition.left)&&statement.isStringOperand(condition.right)){
        statement.emitOperand(condition.left,ASM)
        ASM.addCode('push rax')
        statement.emitOperand(condition.right,ASM)
        ASM.addCode('mov rdx, rax')
        ASM.addCode('pop rcx')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [strcmp]')
        ASM.addCode('add rsp, 40')
        ASM.addImport('msvcrt','strcmp')
        ASM.addCode('test eax, eax')
        ASM.addCode(['==','==='].includes(condition.operator)
            ? `je ${trueLabel}`
            : `jne ${trueLabel}`)
        ASM.addCode(`jmp ${falseLabel}`)
        return
    }
    const isFloat = statement.isFloatOperand(condition.left)
    const rightIsFloat = statement.isFloatOperand(condition.right)
    if(isFloat||rightIsFloat){
        statement.emitOperand(condition.left,ASM)
        const leftFloat = statement.isFloatOperand(condition.left)
        if(!leftFloat){
            ASM.addCode('cvtsi2sd xmm0, rax')
        }
        ASM.addCode('sub rsp, 8')
        ASM.addCode('movsd qword [rsp], xmm0')
        statement.emitOperand(condition.right,ASM)
        const rightFloat = statement.isFloatOperand(condition.right)
        if(!rightFloat){
            ASM.addCode('cvtsi2sd xmm0, rax')
        }
        ASM.addCode('movsd xmm1, xmm0')
        ASM.addCode('movsd xmm0, qword [rsp]')
        ASM.addCode('add rsp, 8')
        ASM.addCode('ucomisd xmm0, xmm1')
        statement.emitComparisonJump(condition.operator,ASM,trueLabel,falseLabel,true)
        return
    }
    statement.emitOperand(condition.left,ASM)
    ASM.addCode('push rax')
    statement.emitOperand(condition.right,ASM)
    ASM.addCode('mov rcx, rax')
    ASM.addCode('pop rax')
    ASM.addCode('cmp rax, rcx')
    statement.emitComparisonJump(condition.operator,ASM,trueLabel,falseLabel,false)
}

export function emitComparisonJump(statement:Iff,operator:string,ASM:Asm,trueLabel:string,falseLabel:string,float:boolean){
    const jumps:Record<string,string> = float
        ? {'==':'je','===':'je','!=':'jne','!==':'jne','<':'jb','<=':'jbe','>':'ja'}
        : {'==':'je','===':'je','!=':'jne','!==':'jne','<':'jl','<=':'jle','>':'jg'}
    if(operator==='>='){
        if(float){
            ASM.addCode(`jp ${falseLabel}`)
            ASM.addCode(`jb ${falseLabel}`)
        }else{
            ASM.addCode(`jl ${falseLabel}`)
        }
        ASM.addCode(`jmp ${trueLabel}`)
        return
    }
    if(float&&['==','===','<','<=','>','>='].includes(operator)){
        ASM.addCode(`jp ${falseLabel}`)
    }else if(float&&['!=','!=='].includes(operator)){
        ASM.addCode(`jp ${trueLabel}`)
    }
    ASM.addCode(`${jumps[operator]} ${trueLabel}`)
    ASM.addCode(`jmp ${falseLabel}`)
}
