import Asm from '../asm.ts'
import type {Expression} from './types.ts'

let labelId = 0

function nextLabel(prefix:string){
    return `__ds_math_${prefix}_${++labelId}`
}

function emitNegate(ASM:Asm,register:string){
    ASM.addCode(`neg ${register}`)
}

function emitMultiply(ASM:Asm,left:string,right:string){
    if(left!=='rax'){
        ASM.addCode(`mov rax, ${left}`)
    }
    ASM.addCode(`imul rax, ${right}`)
}

function emitFloatLiteral(ASM:Asm,value:string,register='xmm0'){
    const label = nextLabel('float')
    const literal = /e/i.test(value)&&!/[f]$/i.test(value)?`${value}f`:value
    ASM.addData(`${label} dq ${literal}`)
    ASM.addCode(`movsd ${register}, qword [${label}]`)
}

function emitAsFloat(expression:Expression,ASM:Asm){
    emitExpression(expression,ASM)
    if(expression.numericKind==='integer'){
        ASM.addCode('cvtsi2sd xmm0, rax')
    }
}

function addRuntimeImport(ASM:Asm,name:string){
    const functions = ASM.imp.msvcrt??[]
    if(!functions.includes(name)){
        ASM.addImport('msvcrt',name)
    }
}

function emitFloatCall(ASM:Asm,name:string){
    addRuntimeImport(ASM,name)
    ASM.addCode('sub rsp, 40')
    ASM.addCode(`call [${name}]`)
    ASM.addCode('add rsp, 40')
}

function emitFloatExpression(expression:Extract<Expression,{kind:'binary'}>,ASM:Asm){
    emitAsFloat(expression.left,ASM)
    const leftValue = nextLabel('float_arg')
    ASM.addData(`${leftValue} dq 0`)
    ASM.addCode(`movsd qword [${leftValue}], xmm0`)
    emitAsFloat(expression.right,ASM)
    ASM.addCode('movsd xmm1, xmm0')
    ASM.addCode(`movsd xmm0, qword [${leftValue}]`)

    switch(expression.operator){
        case '+':
            ASM.addCode('addsd xmm0, xmm1')
            break
        case '-':
            ASM.addCode('subsd xmm0, xmm1')
            break
        case '*':
            ASM.addCode('mulsd xmm0, xmm1')
            break
        case '/':
            ASM.addCode('divsd xmm0, xmm1')
            break
        case '%':
            emitFloatCall(ASM,'fmod')
            break
        case '**':
            emitFloatCall(ASM,'pow')
            break
    }
}

function emitSignedDivision(ASM:Asm,remainder:boolean){
    ASM.addCode('cqo')
    ASM.addCode('idiv rcx')
    if(remainder){
        ASM.addCode('mov rax, rdx')
    }
}

function emitPower(ASM:Asm){
    const prefix = nextLabel('pow')
    const nonnegative = `${prefix}_nonnegative`
    const loop = `${prefix}_loop`
    const skipMultiply = `${prefix}_skip_multiply`
    const calculated = `${prefix}_calculated`
    const done = `${prefix}_done`

    ASM.addCode('mov r8, rax')
    ASM.addCode('mov r9, rcx')
    ASM.addCode('mov r10, 0')
    ASM.addCode('test r9, r9')
    ASM.addCode(`jns ${nonnegative}`)
    emitNegate(ASM,'r9')
    ASM.addCode('mov r10, 1')
    ASM.addCode(`${nonnegative}:`)
    ASM.addCode('mov r11, 1')
    ASM.addCode(`${loop}:`)
    ASM.addCode('test r9, r9')
    ASM.addCode(`jz ${calculated}`)
    ASM.addCode('xor rdx, rdx')
    ASM.addCode('mov rax, r9')
    ASM.addCode('mov rcx, 2')
    ASM.addCode('div rcx')
    ASM.addCode('mov r9, rax')
    ASM.addCode('test rdx, rdx')
    ASM.addCode(`jz ${skipMultiply}`)
    ASM.addCode('imul r11, r8')
    ASM.addCode(`${skipMultiply}:`)
    ASM.addCode('imul r8, r8')
    ASM.addCode(`jmp ${loop}`)
    ASM.addCode(`${calculated}:`)
    ASM.addCode('mov rax, r11')
    ASM.addCode('test r10, r10')
    ASM.addCode(`jz ${done}`)
    ASM.addCode('mov rcx, rax')
    ASM.addCode('mov rax, 1')
    ASM.addCode('cqo')
    ASM.addCode('idiv rcx')
    ASM.addCode(`${done}:`)
}

export function emitExpression(expression:Expression,ASM:Asm){
    if(expression.kind==='number'){
        if(expression.numericKind==='float'){
            emitFloatLiteral(ASM,expression.value)
            return
        }
        ASM.addCode(`mov rax, ${expression.value}`)
        return
    }
    if(expression.kind==='mathCall'){
        emitAsFloat(expression.arguments[0],ASM)
        if(expression.arguments.length===2){
            const firstArgument = nextLabel('float_arg')
            ASM.addData(`${firstArgument} dq 0`)
            ASM.addCode(`movsd qword [${firstArgument}], xmm0`)
            emitAsFloat(expression.arguments[1],ASM)
            ASM.addCode('movsd xmm1, xmm0')
            ASM.addCode(`movsd xmm0, qword [${firstArgument}]`)
        }
        emitFloatCall(ASM,expression.name)
        return
    }
    if(expression.kind==='stringLength'){
        const value = expression.value.getCode(true)
        if(value===null){
            throw new Error('Unable to resolve string length')
        }
        if(value.startsWith('addr ')){
            ASM.addCode(`lea rcx, [${value.replace(/^addr\s+/,'')}]`)
        }else{
            ASM.addCode(`mov rcx, ${value}`)
        }
        ASM.addImport('msvcrt','strlen')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [strlen]')
        ASM.addCode('add rsp, 40')
        return
    }
    if(expression.kind==='arrayLength'){
        if(expression.value.isParameter){
            ASM.addCode(`mov rdx, ${expression.value.name}`)
            ASM.addCode('mov rax, [rdx+8]')
        }else{
            ASM.addCode(`mov rax, [${expression.value.name}__length]`)
        }
        return
    }
    if(expression.kind==='data'){
        if(expression.value.isConstAlias){
            ASM.addCode(`mov rax, ${expression.value.name}`)
            return
        }
        const instance = expression.value.classPropertyInstance
        const offset = expression.value.classPropertyOffset
        if(instance?.isProcedureLocal&&offset!==null){
            ASM.addCode(instance.isHeapAllocated
                ? `mov rdx, [${instance.name}]`
                : `lea rdx, [${instance.name}]`)
            if(offset){
                ASM.addCode(`add rdx, ${offset}`)
            }
            ASM.addCode(expression.numericKind==='float'
                ? 'movsd xmm0, qword [rdx]'
                : 'mov rax, [rdx]')
            return
        }
        const parameterValue = expression.value.isParameter&&!expression.value.isArray&&!instance
        if(expression.numericKind==='float'){
            ASM.addCode(parameterValue
                ? `movsd xmm0, qword ${expression.value.getAccessName()}`
                : `movsd xmm0, qword [${expression.value.getAccessName()}]`)
            return
        }
        ASM.addCode(parameterValue
            ? `mov rax, ${expression.value.getAccessName()}`
            : `mov rax, [${expression.value.getAccessName()}]`)
        return
    }
    if(expression.kind==='index'){
        emitExpression(expression.index,ASM)
        ASM.addCode('shl rax, 3')
        const instance = expression.value.classPropertyInstance
        const offset = expression.value.classPropertyOffset
        if(!expression.value.isArray){
            if(instance?.isProcedureLocal&&offset!==null){
                ASM.addCode(instance.isHeapAllocated
                    ? `mov rdx, [${instance.name}]`
                    : `lea rdx, [${instance.name}]`)
                if(offset){
                    ASM.addCode(`add rdx, ${offset}`)
                }
                ASM.addCode('mov rdx, [rdx]')
            }else if(expression.value.isParameter){
                ASM.addCode(`mov rdx, ${expression.value.getAccessName()}`)
            }else if(expression.value.isConstAlias){
                ASM.addCode(`mov rdx, ${expression.value.name}`)
            }else{
                ASM.addCode(`mov rdx, [${expression.value.getAccessName()}]`)
            }
        }else if(instance?.isProcedureLocal&&offset!==null){
            ASM.addCode(`lea rdx, [${instance.name}]`)
            if(offset){
                ASM.addCode(`add rdx, ${offset}`)
            }
            ASM.addCode('add rdx, rax')
        }else if(expression.value.isParameter){
            ASM.addCode(`mov rdx, ${expression.value.getAccessName()}`)
            if(expression.value.dynamicArray){
                ASM.addCode('mov rdx, [rdx]')
            }
        }else if(expression.value.dynamicArray){
            ASM.addCode(`mov rdx, [${expression.value.getAccessName()}]`)
        }else{
            ASM.addCode(`lea rdx, [${expression.value.getAccessName()}]`)
        }
        ASM.addCode('add rdx, rax')
        if(expression.numericKind==='float'){
            ASM.addCode('movsd xmm0, qword [rdx]')
        }else{
            ASM.addCode('mov rax, [rdx]')
        }
        return
    }
    if(expression.kind==='unary'){
        emitExpression(expression.value,ASM)
        if(expression.operator==='-'){
            if(expression.numericKind==='float'){
                emitFloatLiteral(ASM,'-1.0','xmm1')
                ASM.addCode('mulsd xmm0, xmm1')
            }else{
                emitNegate(ASM,'rax')
            }
        }
        return
    }
    if(expression.numericKind==='float'){
        emitFloatExpression(expression,ASM)
        return
    }

    emitExpression(expression.left,ASM)
    ASM.addCode('push rax')
    emitExpression(expression.right,ASM)
    ASM.addCode('mov rcx, rax')
    ASM.addCode('pop rax')

    switch(expression.operator){
        case '+':
            ASM.addCode('add rax, rcx')
            break
        case '-':
            ASM.addCode('sub rax, rcx')
            break
        case '*':
            emitMultiply(ASM,'rax','rcx')
            break
        case '/':
            emitSignedDivision(ASM,false)
            break
        case '%':
            emitSignedDivision(ASM,true)
            break
        case '**':
            emitPower(ASM)
            break
    }
}
