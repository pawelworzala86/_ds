import Asm from '../../asm.ts'
import {emitExpression} from '../../maths.ts'
import DataElement from '../dataElement.ts'
import {getClassPropertyOffset} from '../clasElement.ts'
import {getTypedArrayInfo} from '../data/typedArrays.ts'
import {nextFunctionArgumentId} from './ids.ts'
import type {FunctionArgument} from '../functionArgument.ts'

export function emitFunctionArgument(argument:FunctionArgument,ASM:Asm){
    if(argument.addressOf&&argument.classPropertyInstance&&argument.classProperty){
        if(argument.classPropertyInstance.isHeapAllocated){
            const classType = argument.classPropertyInstance.classType
                ? argument.scope.getClass(argument.classPropertyInstance.classType)
                : null
            const offset = classType
                ? getClassPropertyOffset(classType,argument.classPropertyOffsetPath??argument.classProperty.name??'',name=>argument.scope.getClass(name))
                : null
            if(offset===null){
                throw new Error(`Unable to resolve local struct property "${argument.classPropertyOffsetPath??argument.classProperty.name}"`)
            }
            argument.tempName ??= `__ds_call_arg_${nextFunctionArgumentId()}`
            ASM.addCode(`mov rdx, [${argument.classPropertyInstance.name}]`)
            if(offset){
                ASM.addCode(`add rdx, ${offset}`)
            }
            ASM.addData(`${argument.tempName} dq 0`)
            ASM.addCode(`mov [${argument.tempName}], rdx`)
            return
        }
        return
    }
    if(argument.methodPointerName&&argument.methodInstance&&argument.methodName&&argument.methodClassType){
        const methodLabel = `${argument.methodClassType}.${argument.methodName}`
        const callbackParams = Array.from(
            {length:Math.min(argument.methodParamCount,3)},
            (_,index)=>`__ds_method_arg_${index+1}`
        )
        const body = [`proc ${argument.methodPointerName}${callbackParams.length?`, ${callbackParams.join(', ')}`:''}`]
        for(let index=0;index<callbackParams.length;index++){
            body.push(`mov ${['rdx','r8','r9'][index]}, ${callbackParams[index]}`)
        }
        body.push(argument.methodInstance.isHeapAllocated
            ? `mov rcx, [${argument.methodInstance.name}]`
            : `lea rcx, [${argument.methodInstance.name}]`)
        body.push('sub rsp, 32')
        body.push(`call ${methodLabel}`)
        body.push('add rsp, 32')
        body.push('ret')
        body.push('endp')
        ASM.addProc(body.join('\n'))
    }
    if(argument.classPropertyInstance?.isProcedureLocal&&argument.classProperty&&!argument.classProperty.isArray&&argument.value instanceof DataElement){
        const classType = argument.classPropertyInstance.classType
            ? argument.scope.getClass(argument.classPropertyInstance.classType)
            : null
        const offset = classType
            ? getClassPropertyOffset(classType,argument.classPropertyOffsetPath??argument.classProperty.name??'',name=>argument.scope.getClass(name))
            : null
        if(offset===null){
            throw new Error(`Unable to resolve local struct property "${argument.classPropertyOffsetPath??argument.classProperty.name}"`)
        }
        argument.tempName ??= `__ds_call_arg_${nextFunctionArgumentId()}`
        ASM.addCode(argument.classPropertyInstance.isHeapAllocated
            ? `mov rdx, [${argument.classPropertyInstance.name}]`
            : `lea rdx, [${argument.classPropertyInstance.name}]`)
        if(offset){
            ASM.addCode(`add rdx, ${offset}`)
        }
        if(argument.classProperty.type==='number'&&argument.classProperty.numericKind==='float'){
            ASM.addCode('movsd xmm0, qword [rdx]')
            ASM.addData(`${argument.tempName} dq 0`)
            ASM.addCode(`movsd qword [${argument.tempName}], xmm0`)
        }else{
            ASM.addCode('mov rax, [rdx]')
            ASM.addData(`${argument.tempName} dq 0`)
            ASM.addCode(`mov [${argument.tempName}], rax`)
        }
        return
    }
    if(argument.classPropertyInstance&&argument.classProperty&&argument.value instanceof DataElement){
        argument.value.name = argument.getClassPropertyAccessName()
    }
    if(argument.classPropertyInstance?.isParameter&&argument.classProperty&&!argument.classProperty.isArray&&argument.tempName){
        const classType = argument.classPropertyInstance.classType
            ? argument.scope.getClass(argument.classPropertyInstance.classType)
            : null
        const offset = classType
            ? getClassPropertyOffset(classType,argument.classPropertyOffsetPath??argument.classProperty.name??'',name=>argument.scope.getClass(name))
            : null
        if(offset===null){
            throw new Error(`Unable to resolve struct parameter property "${argument.classProperty.name}"`)
        }
        ASM.addCode(`mov rdx, ${argument.classPropertyInstance.name}`)
        ASM.addCode(`mov rax, [rdx+${offset}]`)
        ASM.addData(`${argument.tempName} dq 0`)
        ASM.addCode(`mov [${argument.tempName}], rax`)
        return
    }
    if(argument.arrayPropertyAccess&&argument.tempName){
        const {array,indexExpression,property,offset} = argument.arrayPropertyAccess
        emitExpression(indexExpression,ASM)
        ASM.addCode('shl rax, 3')
        if(array.isParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            if(array.dynamicArray){
                ASM.addCode('mov rdx, [rdx]')
            }
        }else{
            ASM.addCode(array.dynamicArray
                ? `mov rdx, [${array.name}]`
                : `lea rdx, [${array.name}]`)
        }
        ASM.addCode('add rdx, rax')
        ASM.addCode('mov rax, [rdx]')
        if(offset){
            ASM.addCode(`add rax, ${offset}`)
        }
        ASM.addCode('mov rax, [rax]')
        ASM.addData(`${argument.tempName} dq 0`)
        ASM.addCode(`mov [${argument.tempName}], rax`)
        return
    }
    if(argument.arrayElementAccess&&argument.tempName){
        const {array,indexExpression} = argument.arrayElementAccess
        const typedArrayInfo = getTypedArrayInfo(array.typedArrayKind)
        emitExpression(indexExpression,ASM)
        if(typedArrayInfo){
            if(typedArrayInfo.bytesPerElement>1){
                ASM.addCode(`shl rax, ${Math.log2(typedArrayInfo.bytesPerElement)}`)
            }
        }else{
            ASM.addCode('shl rax, 3')
        }
        if(array.isParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            if(array.dynamicArray){
                ASM.addCode('mov rdx, [rdx]')
            }
        }else{
            ASM.addCode(array.dynamicArray
                ? `mov rdx, [${array.name}]`
                : `lea rdx, [${array.name}]`)
        }
        ASM.addCode('add rdx, rax')
        ASM.addData(`${argument.tempName} dq 0`)
        if(typedArrayInfo?.float){
            if(typedArrayInfo.bytesPerElement===4){
                ASM.addCode('cvtss2sd xmm0, dword [rdx]')
            }else{
                ASM.addCode('movsd xmm0, qword [rdx]')
            }
            ASM.addCode(`movsd qword [${argument.tempName}], xmm0`)
        }else if(typedArrayInfo?.bigint){
            ASM.addCode('mov rax, qword [rdx]')
            ASM.addCode(`mov [${argument.tempName}], rax`)
        }else if(typedArrayInfo){
            const width = typedArrayInfo.bytesPerElement
            const operand = width===1?'byte':width===2?'word':'dword'
            const extension = typedArrayInfo.signed
                ? width===4?'movsxd rax, dword [rdx]':`movsx rax, ${operand} [rdx]`
                : width===4?'mov eax, dword [rdx]':`movzx rax, ${operand} [rdx]`
            ASM.addCode(extension)
            ASM.addCode(`mov [${argument.tempName}], rax`)
        }else{
            ASM.addCode('mov rax, [rdx]')
            ASM.addCode(`mov [${argument.tempName}], rax`)
        }
        return
    }
    if(argument.arrayPointerName&&argument.value instanceof DataElement){
        ASM.addData(`${argument.arrayPointerName} dq 0`)
        ASM.addCode(argument.value.dynamicArray
            ? `mov rax, [${argument.value.name}]`
            : `mov rax, ${argument.value.name}`)
        ASM.addCode(`mov [${argument.arrayPointerName}], rax`)
    }
    if(argument.tempName&&argument.value instanceof DataElement&&argument.value.isParameter&&!argument.expression){
        ASM.addData(`${argument.tempName} dq 0`)
        ASM.addCode(`mov rax, ${argument.value.name}`)
        ASM.addCode(`mov [${argument.tempName}], rax`)
        return
    }
    if(!argument.expression||!argument.tempName){
        return
    }
    emitExpression(argument.expression,ASM)
    ASM.addData(`${argument.tempName} dq 0`)
    ASM.addCode(argument.expression.numericKind==='float'
        ? `movsd qword [${argument.tempName}], xmm0`
        : `mov [${argument.tempName}], rax`)
}
