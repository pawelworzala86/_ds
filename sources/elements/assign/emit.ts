import Asm from '../../asm.ts'
import {emitExpression} from '../../maths.ts'
import {stringLiteralData} from '../../stringLiteral.ts'
import {getStructFields,initializeStackStructStrings} from '../data/struct.ts'
import type {Assign} from '../assign.ts'

let stringAssignId = 0
let promiseAwaitId = 0
let arrayLengthUpdateId = 0
let arrayClassInstanceId = 0

export function emitAssign(assignment:Assign,ASM:Asm){
    if(!assignment.target){
        throw new Error('Assignment is not initialized')
    }
    const targetName = assignment.target.getAccessName()
    const storeTarget = (value:string,asFloat=false)=>{
        const instance = assignment.target?.classPropertyInstance
        const offset = assignment.target?.classPropertyOffset
        if((instance?.isProcedureLocal||instance?.isReferenceAlias)&&offset!==null&&offset!==undefined){
            ASM.addCode(instance.isHeapAllocated
                ? `mov rdx, [${instance.name}]`
                : `lea rdx, [${instance.name}]`)
            ASM.addCode(asFloat
                ? `movsd qword [rdx+${offset}], ${value}`
                : `mov [rdx+${offset}], ${value}`)
            return
        }
        ASM.addCode(asFloat
            ? `movsd qword [${targetName}], ${value}`
            : `mov [${targetName}], ${value}`)
    }
    const updateDynamicArrayLength = ()=>{
        const target = assignment.target!
        const index = assignment.targetIndex
        if(!target.dynamicArray||!index||target.classPropertyInstance){
            return
        }
        const done = `__ds_array_length_update_${++arrayLengthUpdateId}`
        emitExpression(index,ASM)
        ASM.addCode('inc rax')
        if(target.isParameter){
            ASM.addCode(`mov rdx, ${target.name}`)
            ASM.addCode('cmp qword [rdx+8], rax')
            ASM.addCode(`jnb ${done}`)
            ASM.addCode('mov [rdx+8], rax')
        }else{
            ASM.addCode(`cmp qword [${target.name}__length], rax`)
            ASM.addCode(`jnb ${done}`)
            ASM.addCode(`mov [${target.name}__length], rax`)
        }
        ASM.addCode(`${done}:`)
    }
    if(assignment.asyncCall){
        const target = assignment.target
        if(!target.name){
            throw new Error('Task assignment target is not initialized')
        }
        assignment.asyncCall.asm(ASM,'handle')
        ASM.addCode(`mov [${target.getAccessName()}], rax`)
        return
    }
    if(assignment.promiseAwait){
        const promise = assignment.promiseAwait
        if(!promise.name){
            throw new Error('Awaited Promise is not initialized')
        }
        const id = ++promiseAwaitId
        const failure = `__ds_promise_await_failure_${id}`
        const done = `__ds_promise_await_done_${id}`
        const wait = `__ds_promise_await_wait_${id}`
        const settled = `__ds_promise_await_settled_${id}`
        ASM.addImport('kernel32','ExitProcess')
        ASM.addImport('kernel32','Sleep')
        ASM.addCode(`${wait}:`)
        ASM.addCode(`cmp qword [${promise.name}__state], 0`)
        ASM.addCode(`jne ${settled}`)
        ASM.addCode('mov ecx, 1')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [Sleep]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`jmp ${wait}`)
        ASM.addCode(`${settled}:`)
        ASM.addCode(`cmp qword [${promise.name}__state], 1`)
        ASM.addCode(`jne ${failure}`)
        ASM.addCode(`mov rax, [${promise.name}__value]`)
        if(assignment.target.classType&&!assignment.target.isArray){
            const classType = assignment.parent?.getClass(assignment.target.classType)
            if(!classType){
                throw new Error(`Unknown class type "${assignment.target.classType}" for awaited Promise`)
            }
            const fields = getStructFields(
                assignment.target.classLayoutProps??classType.props,
                name=>assignment.parent!.getClass(name)
            )
            ASM.addCode('mov rdx, rax')
            const instance = assignment.target.classPropertyInstance
            const offset = assignment.target.classPropertyOffset
            if((instance?.isProcedureLocal||instance?.isReferenceAlias)&&offset!==null&&offset!==undefined){
                ASM.addCode(instance.isHeapAllocated
                    ? `mov rcx, [${instance.name}]`
                    : `lea rcx, [${instance.name}]`)
                if(offset){
                    ASM.addCode(`add rcx, ${offset}`)
                }
            }else if(assignment.target.isProcedureLocal
                &&(assignment.target.isHeapAllocated||assignment.target.isReferenceAlias)){
                ASM.addCode(`mov rcx, [${targetName}]`)
            }else{
                ASM.addCode(`lea rcx, [${targetName}]`)
            }
            fields.forEach((_,index)=>{
                const fieldOffset = index*8
                ASM.addCode(`mov rax, [rdx+${fieldOffset}]`)
                ASM.addCode(`mov [rcx+${fieldOffset}], rax`)
            })
        }else if(assignment.target.type==='number'&&assignment.target.numericKind==='float'){
            ASM.addCode('movq xmm0, rax')
            storeTarget('xmm0',true)
        }else{
            storeTarget('rax')
        }
        ASM.addCode(`jmp ${done}`)
        ASM.addCode(`${failure}:`)
        ASM.addCode('mov ecx, 1')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [ExitProcess]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`${done}:`)
        return
    }
    if(assignment.timeout){
        const target = assignment.target
        if(!target.name){
            throw new Error('Task assignment target is not initialized')
        }
        assignment.timeout.asm(ASM,'handle')
        ASM.addCode(`mov [${target.getAccessName()}], rax`)
        return
    }
    if(assignment.stringPropertyTarget){
        const valueLabel = `__ds_str_assign_${++stringAssignId}`
        ASM.addData(`${valueLabel} ${stringLiteralData(assignment.stringValue!)}`)
        ASM.addCode(`lea rax, [${valueLabel}]`)
        storeTarget('rax')
        return
    }
    if(assignment.target.type==='string'&&!assignment.target.isArray){
        if(!assignment.stringAppend){
            if(assignment.stringCall){
                assignment.stringCall.asm(ASM)
                storeTarget('rax')
                return
            }
            if(assignment.stringValue){
                const valueLabel = `__ds_str_assign_${++stringAssignId}`
                ASM.addData(`${valueLabel} ${stringLiteralData(assignment.stringValue)}`)
                ASM.addCode(`lea rax, [${valueLabel}]`)
            }else if(assignment.stringSource){
                ASM.addCode(assignment.stringSource.isParameter
                    ? `mov rax, ${assignment.stringSource.name}`
                    : `mov rax, [${assignment.stringSource.name}]`)
            }else{
                throw new Error('String assignment is not initialized')
            }
            storeTarget('rax')
            return
        }
        const id = ++stringAssignId
        const destinationLabel = `__ds_str_append_destination_${id}`
        const sourceLabel = `__ds_str_append_source_${id}`
        const lengthLabel = `__ds_str_append_length_${id}`
        const bufferLabel = `__ds_str_append_buffer_${id}`
        const allocationError = `__ds_str_append_error_${id}`
        const allocationReady = `__ds_str_append_ready_${id}`
        if(assignment.stringValue){
            const valueLabel = `__ds_str_assign_${id}`
            ASM.addData(`${valueLabel} ${stringLiteralData(assignment.stringValue)}`)
            ASM.addCode(`lea rax, [${valueLabel}]`)
        }else if(assignment.stringSource){
            ASM.addCode(assignment.stringSource.isParameter
                ? `mov rax, ${assignment.stringSource.name}`
                : `mov rax, [${assignment.stringSource.name}]`)
        }else{
            throw new Error('String append source is not initialized')
        }
        ASM.addData(`${destinationLabel} dq 0`)
        ASM.addData(`${sourceLabel} dq 0`)
        ASM.addData(`${lengthLabel} dq 0`)
        ASM.addData(`${bufferLabel} dq 0`)
        ASM.addCode(`mov [${sourceLabel}], rax`)
        ASM.addCode(assignment.target.isParameter
            ? `mov rax, ${targetName}`
            : `mov rax, [${targetName}]`)
        ASM.addCode(`mov [${destinationLabel}], rax`)
        ASM.addImport('msvcrt','strlen')
        ASM.addImport('msvcrt','malloc')
        ASM.addImport('msvcrt','strcpy')
        ASM.addImport('msvcrt','strcat')
        ASM.addCode(`mov rcx, [${destinationLabel}]`)
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [strlen]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`mov [${lengthLabel}], rax`)
        ASM.addCode(`mov rcx, [${sourceLabel}]`)
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [strlen]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`add rax, [${lengthLabel}]`)
        ASM.addCode('inc rax')
        ASM.addCode('mov rcx, rax')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [malloc]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`mov [${bufferLabel}], rax`)
        ASM.addCode('test rax, rax')
        ASM.addCode(`jz ${allocationError}`)
        ASM.addCode(`mov rcx, [${bufferLabel}]`)
        ASM.addCode(`mov rdx, [${destinationLabel}]`)
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [strcpy]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`mov rcx, [${bufferLabel}]`)
        ASM.addCode(`mov rdx, [${sourceLabel}]`)
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [strcat]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`mov rax, [${bufferLabel}]`)
        storeTarget('rax')
        ASM.addCode(`jmp ${allocationReady}`)
        ASM.addCode(`${allocationError}:`)
        ASM.addCode('mov ecx, 1')
        ASM.addCode('sub rsp, 40')
        ASM.addImport('kernel32','ExitProcess')
        ASM.addCode('call [ExitProcess]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`${allocationReady}:`)
        return
    }
    if(assignment.addressLabel){
        ASM.addCode(`lea rax, [${assignment.addressFunction?.nativeCallbackName??assignment.addressFunction?.name??assignment.addressLabel}]`)
        storeTarget('rax')
        return
    }
    if(assignment.invokeExpression){
        assignment.invokeExpression.asm(ASM)
        storeTarget('rax')
        return
    }
    if(assignment.functionCall){
        assignment.functionCall.asm(ASM)
        storeTarget('rax')
        return
    }
    if(assignment.arrayCall){
        assignment.arrayCall.asm(ASM)
        ASM.addCode('mov rdx, rax')
        ASM.addCode('mov rax, [rdx]')
        ASM.addCode(`mov [${targetName}], rax`)
        ASM.addCode('mov rax, [rdx+8]')
        ASM.addCode(`mov [${targetName}__length], rax`)
        ASM.addCode('mov rax, [rdx+16]')
        ASM.addCode(`mov [${targetName}__capacity], rax`)
        return
    }
    if(assignment.arrayPropertyTarget&&assignment.expression){
        const {array,index,property,offset} = assignment.arrayPropertyTarget
        emitExpression(index,ASM)
        ASM.addCode('shl rax, 3')
        ASM.addCode(array.dynamicArray
            ? `mov rdx, [${array.name}]`
            : `lea rdx, [${array.name}]`)
        ASM.addCode('add rdx, rax')
        ASM.addCode('mov rdx, [rdx]')
        if(offset){
            ASM.addCode(`add rdx, ${offset}`)
        }
        ASM.addCode('push rdx')
        emitExpression(assignment.expression,ASM)
        ASM.addCode('pop rdx')
        if(assignment.expression.numericKind==='float'||property.numericKind==='float'){
            if(assignment.expression.numericKind==='integer'){
                ASM.addCode('cvtsi2sd xmm0, rax')
            }
            ASM.addCode('movsd qword [rdx], xmm0')
        }else{
            ASM.addCode('mov [rdx], rax')
        }
        return
    }
    if(assignment.arrayClassType||assignment.arrayClassValue){
        const target = assignment.target
        const index = assignment.targetIndex
        const classTypeName = assignment.arrayClassType??target.classType
        if(!target.isArray||!classTypeName||!index){
            throw new Error('Object-array assignment is not initialized')
        }
        emitExpression(index,ASM)
        ASM.addCode('shl rax, 3')
        ASM.addCode(target.dynamicArray
            ? `mov rdx, [${target.name}]`
            : `lea rdx, [${target.name}]`)
        ASM.addCode('add rdx, rax')
        ASM.addCode('push rdx')
        if(assignment.arrayClassValue){
            const source = assignment.arrayClassValue
            ASM.addCode(source.isProcedureLocal&&source.isHeapAllocated
                ? `mov rax, [${source.name}]`
                : source.isParameter
                    ? `mov rax, ${source.name}`
                    : `lea rax, [${source.name}]`)
        }else{
            const classType = assignment.parent?.getClass(classTypeName)
            if(!classType){
                throw new Error(`Unknown class type "${classTypeName}"`)
            }
            const fields = getStructFields(classType.props,name=>assignment.parent!.getClass(name))
            const id = ++arrayClassInstanceId
            const instance = `__ds_array_class_instance_${id}`
            const allocationError = `__ds_array_class_instance_error_${id}`
            const allocationReady = `__ds_array_class_instance_ready_${id}`
            ASM.addData(`${instance} dq 0`)
            ASM.addImport('msvcrt','calloc')
            ASM.addCode(`mov rcx, ${Math.max(1,fields.length)}`)
            ASM.addCode('mov rdx, 8')
            ASM.addCode('sub rsp, 40')
            ASM.addCode('call [calloc]')
            ASM.addCode('add rsp, 40')
            ASM.addCode('test rax, rax')
            ASM.addCode(`jz ${allocationError}`)
            ASM.addCode(`mov [${instance}], rax`)
            fields.forEach((property,fieldIndex)=>{
                if(!property.value||property.value==='0'||property.type==='string'){
                    return
                }
                if(property.type==='number'&&property.numericKind==='float'){
                    const literal = `__ds_array_class_literal_${id}_${fieldIndex}`
                    ASM.addData(`${literal} dq ${property.value}`)
                    ASM.addCode(`movsd xmm0, qword [${literal}]`)
                    ASM.addCode(`mov rdx, [${instance}]`)
                    ASM.addCode(`movsd qword [rdx+${fieldIndex*8}], xmm0`)
                }else{
                    ASM.addCode(`mov rax, ${property.value}`)
                    ASM.addCode(`mov rdx, [${instance}]`)
                    ASM.addCode(`mov [rdx+${fieldIndex*8}], rax`)
                }
            })
            initializeStackStructStrings(ASM,instance,fields,true)
            const constructor = classType.getFunction('constructor')
            if(constructor){
                ASM.addCode('sub rsp, 40')
                ASM.addCode(`mov rcx, [${instance}]`)
                ASM.addCode(`call ${classType.name}.constructor`)
                ASM.addCode('add rsp, 40')
            }
            ASM.addCode(`mov rax, [${instance}]`)
            ASM.addCode(`jmp ${allocationReady}`)
            ASM.addCode(`${allocationError}:`)
            ASM.addCode('mov ecx, 1')
            ASM.addCode('sub rsp, 40')
            ASM.addImport('kernel32','ExitProcess')
            ASM.addCode('call [ExitProcess]')
            ASM.addCode('add rsp, 40')
            ASM.addCode(`${allocationReady}:`)
        }
        ASM.addCode('pop rdx')
        ASM.addCode('mov [rdx], rax')
        updateDynamicArrayLength()
        return
    }
    if(assignment.target.isArray && (
        assignment.target.type==='string'
        ||assignment.target.type==='string[]'
        ||assignment.target.type==='any'&&(assignment.stringValue!==null||assignment.stringSource!==null)
    )){
        if(assignment.targetIndex){
            emitExpression(assignment.targetIndex,ASM)
            ASM.addCode('shl rax, 3')
            if(assignment.target.isParameter){
                ASM.addCode(`mov rdx, ${targetName}`)
                if(assignment.target.dynamicArray){
                    ASM.addCode('mov rdx, [rdx]')
                }
            }else if(assignment.target.dynamicArray){
                ASM.addCode(`mov rdx, [${targetName}]`)
            }else{
                ASM.addCode(`lea rdx, [${targetName}]`)
            }
            ASM.addCode('add rdx, rax')
            ASM.addCode('push rdx')
        }
        const valueLabel = assignment.stringValue
            ? `__ds_str_assign_${++stringAssignId}`
            : null
        if(assignment.stringValue){
            ASM.addData(`${valueLabel} ${stringLiteralData(assignment.stringValue)}`)
            ASM.addCode(`lea rax, [${valueLabel}]`)
        }else if(assignment.stringSourceIndex&&assignment.stringSource){
            emitExpression(assignment.stringSourceIndex,ASM)
            ASM.addCode('shl rax, 3')
            if(assignment.stringSource.isParameter){
                ASM.addCode(`mov rdx, ${assignment.stringSource.name}`)
                if(assignment.stringSource.dynamicArray){
                    ASM.addCode('mov rdx, [rdx]')
                }
            }else{
                ASM.addCode(assignment.stringSource.dynamicArray
                    ? `mov rdx, [${assignment.stringSource.name}]`
                    : `lea rdx, [${assignment.stringSource.name}]`)
            }
            ASM.addCode('add rdx, rax')
            ASM.addCode('mov rax, [rdx]')
        }else if(assignment.stringSource){
            ASM.addCode(`lea rax, [${assignment.stringSource.name}]`)
        }
        if(assignment.targetIndex){
            ASM.addCode('pop rdx')
            ASM.addCode('mov [rdx], rax')
            updateDynamicArrayLength()
            return
        }
        throw new Error('String array assignment is not initialized')
    }
    if(!assignment.expression){
        throw new Error('Assignment is not initialized')
    }
    if(assignment.targetIndex){
        emitExpression(assignment.targetIndex,ASM)
        ASM.addCode('shl rax, 3')
        if(assignment.target!.isParameter){
            ASM.addCode(`mov rdx, ${targetName}`)
            if(assignment.target!.dynamicArray){
                ASM.addCode('mov rdx, [rdx]')
            }
        }else if(assignment.target!.dynamicArray){
            ASM.addCode(`mov rdx, [${targetName}]`)
        }else{
            ASM.addCode(`lea rdx, [${targetName}]`)
        }
        ASM.addCode('add rdx, rax')
        ASM.addCode('push rdx')
    }
    emitExpression(assignment.expression,ASM)
    if(assignment.targetIndex){
        ASM.addCode('pop rdx')
        const anyArray = assignment.target.isArray&&assignment.target.type==='any'
        if(assignment.expression.numericKind==='float'||!anyArray&&assignment.target.numericKind==='float'){
            if(assignment.expression.numericKind==='integer'){
                ASM.addCode('cvtsi2sd xmm0, rax')
            }
            ASM.addCode('movsd qword [rdx], xmm0')
        }else{
            ASM.addCode('mov [rdx], rax')
        }
        updateDynamicArrayLength()
        return
    }
    if(assignment.expression.numericKind==='float'){
        storeTarget('xmm0',true)
    }else if(assignment.target.numericKind==='float'){
        ASM.addCode('cvtsi2sd xmm0, rax')
        storeTarget('xmm0',true)
    }else{
        storeTarget('rax')
    }
}
