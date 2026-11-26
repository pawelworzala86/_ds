import Asm from '../../asm.ts'
import DataElement from '../dataElement.ts'
import {stringLiteralData} from '../../stringLiteral.ts'
import type {Call} from '../call.ts'

let arrayPushEmissionId = 0

export function emitArrayPush(call:Call,ASM:Asm){
        const array = call.builtinArray!
        const param = call.params[0]
        const id = ++arrayPushEmissionId
        const valueName = `__ds_array_push_value_${id}`
        const nextCapacityName = `__ds_array_push_capacity_${id}`
        const lengthName = `${array.name}__length`
        const capacityName = `${array.name}__capacity`
        const growLabel = `__ds_array_push_grow_${id}`
        const readyLabel = `__ds_array_push_ready_${id}`
        const errorLabel = `__ds_array_push_error_${id}`
        const dynamicParameter = array.isParameter
        const dynamicProperty = Boolean(array.classPropertyInstance&&array.classPropertyOffset!==null)
        const emitPropertyBase = ()=>{
            const instance = array.classPropertyInstance
            if(!instance||array.classPropertyOffset===null){
                throw new Error('Dynamic class array property is not initialized')
            }
            ASM.addCode(instance.isHeapAllocated
                ? `mov rdx, [${instance.name}]`
                : `lea rdx, [${instance.name}]`)
            if(array.classPropertyOffset){
                ASM.addCode(`add rdx, ${array.classPropertyOffset}`)
            }
        }
        if(dynamicProperty&&!array.classPropertyDynamicArray){
            throw new Error('Array.push requires a dynamic class array property')
        }

        ASM.addData(`${valueName} dq 0`)
        ASM.addData(`${nextCapacityName} dq 0`)
        if((array.type==='string'||array.type==='any')&&typeof param.value==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(param.value)){
            const stringLabel = `__ds_array_push_string_${id}`
            ASM.addData(`${stringLabel} ${stringLiteralData(param.value)}`)
            ASM.addCode(`lea rax, [${stringLabel}]`)
        }else if((array.type==='boolean'||array.type==='any')&&typeof param.value==='string'&&(param.value==='true'||param.value==='false')){
            ASM.addCode(`mov rax, ${param.value==='true'?'1':'0'}`)
        }else if(array.type==='any'&&param.tempName){
            ASM.addCode(`mov rax, [${param.tempName}]`)
        }else if(array.type==='number'&&array.numericKind==='float'&&(param.expression?.numericKind==='integer'||param.value instanceof DataElement&&param.value.numericKind==='integer')){
            if(param.tempName){
                ASM.addCode(`mov rax, [${param.tempName}]`)
            }else if(param.value instanceof DataElement){
                ASM.addCode(`mov rax, [${param.value.name}]`)
            }else{
                throw new Error('Unable to resolve numeric Array.push argument')
            }
            ASM.addCode('cvtsi2sd xmm0, rax')
            ASM.addCode(`movsd qword [${valueName}], xmm0`)
            ASM.addCode(`mov rax, [${valueName}]`)
        }else if(param.arrayElementAccess||param.arrayPropertyAccess||param.tempName){
            ASM.addCode(`mov rax, [${param.tempName}]`)
        }else if(param.value instanceof DataElement){
            if(array.type==='number'||array.type==='any'&&param.value.type==='number'){
                ASM.addCode(`mov rax, [${param.value.name}]`)
            }else if(array.type==='boolean'||array.type==='any'&&param.value.type==='boolean'){
                ASM.addCode(param.value.isParameter
                    ? `mov rax, ${param.value.name}`
                    : `mov rax, [${param.value.name}]`)
            }else if(array.type==='any'&&param.value.type==='string'){
                ASM.addCode(param.value.isParameter
                    ? `mov rax, ${param.value.name}`
                    : `mov rax, [${param.value.name}]`)
            }else if(param.value.isProcedureLocal&&param.value.isHeapAllocated){
                ASM.addCode(`mov rax, [${param.value.name}]`)
            }else if(param.value.isParameter){
                ASM.addCode(`mov rax, ${param.value.name}`)
            }else{
                ASM.addCode(`lea rax, [${param.value.name}]`)
            }
        }else{
            throw new Error('Unable to resolve Array.push argument')
        }
        if(!(array.type==='number'&&array.numericKind==='float'&&(param.expression?.numericKind==='integer'||param.value instanceof DataElement&&param.value.numericKind==='integer'))){
            ASM.addCode(`mov [${valueName}], rax`)
        }
        if(dynamicProperty){
            emitPropertyBase()
            ASM.addCode('mov rax, [rdx+8]')
            emitPropertyBase()
            ASM.addCode('cmp rax, [rdx+16]')
        }else if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rax, [rdx+8]')
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('cmp rax, [rdx+16]')
        }else{
            ASM.addCode(`mov rax, [${lengthName}]`)
            ASM.addCode(`cmp rax, [${capacityName}]`)
        }
        ASM.addCode(`jnb ${growLabel}`)
        ASM.addCode(`jmp ${readyLabel}`)
        ASM.addCode(`${growLabel}:`)
        if(dynamicProperty){
            emitPropertyBase()
            ASM.addCode('mov rcx, [rdx+16]')
        }else if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rcx, [rdx+16]')
        }else{
            ASM.addCode(`mov rcx, [${capacityName}]`)
        }
        ASM.addCode('test rcx, rcx')
        ASM.addCode(`jnz ${growLabel}_double`)
        ASM.addCode('mov rcx, 4')
        ASM.addCode(`jmp ${growLabel}_allocate`)
        ASM.addCode(`${growLabel}_double:`)
        ASM.addCode('shl rcx, 1')
        ASM.addCode(`${growLabel}_allocate:`)
        ASM.addCode(`mov [${nextCapacityName}], rcx`)
        ASM.addCode('shl rcx, 3')
        if(dynamicProperty){
            emitPropertyBase()
            ASM.addCode('mov rdx, [rdx]')
        }else if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rdx, [rdx]')
        }else{
            ASM.addCode(`mov rdx, [${array.name}]`)
        }
        ASM.addCode('mov r8, rcx')
        ASM.addCode('mov rcx, rdx')
        ASM.addCode('mov rdx, r8')
        ASM.addImport('msvcrt','realloc')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [realloc]')
        ASM.addCode('add rsp, 40')
        ASM.addCode('test rax, rax')
        ASM.addCode(`jz ${errorLabel}`)
        if(dynamicProperty){
            emitPropertyBase()
            ASM.addCode('mov [rdx], rax')
            ASM.addCode(`mov rcx, [${nextCapacityName}]`)
            emitPropertyBase()
            ASM.addCode('mov [rdx+16], rcx')
        }else if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov [rdx], rax')
            ASM.addCode(`mov rcx, [${nextCapacityName}]`)
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov [rdx+16], rcx')
        }else{
            ASM.addCode(`mov [${array.name}], rax`)
            ASM.addCode(`mov rcx, [${nextCapacityName}]`)
            ASM.addCode(`mov [${capacityName}], rcx`)
        }
        ASM.addCode(`${readyLabel}:`)
        if(dynamicProperty){
            emitPropertyBase()
            ASM.addCode('mov rax, [rdx+8]')
        }else if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rax, [rdx+8]')
        }else{
            ASM.addCode(`mov rax, [${lengthName}]`)
        }
        ASM.addCode('shl rax, 3')
        if(dynamicProperty){
            emitPropertyBase()
            ASM.addCode('mov rdx, [rdx]')
        }else if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rdx, [rdx]')
        }else{
            ASM.addCode(`mov rdx, [${array.name}]`)
        }
        ASM.addCode('add rdx, rax')
        ASM.addCode(`mov rcx, [${valueName}]`)
        ASM.addCode('mov [rdx], rcx')
        if(dynamicProperty){
            emitPropertyBase()
            ASM.addCode('inc qword [rdx+8]')
        }else if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('inc qword [rdx+8]')
        }else{
            ASM.addCode(`inc qword [${lengthName}]`)
        }
        ASM.addCode(`jmp ${errorLabel}_done`)
        ASM.addCode(`${errorLabel}:`)
        ASM.addCode('mov ecx, 1')
        ASM.addCode('sub rsp, 40')
        ASM.addImport('kernel32','ExitProcess')
        ASM.addCode('call [ExitProcess]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`${errorLabel}_done:`)
    }
