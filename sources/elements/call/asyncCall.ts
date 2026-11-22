import Asm from '../../asm.ts'
import DataElement from '../dataElement.ts'
import FuncElement from '../funcElement.ts'
import FunctionArgument from '../functionArgument.ts'
import {stringData} from '../../stringLiteral.ts'
import type {Call} from '../call.ts'

let asyncCallId = 0

export function emitAsyncCall(call:Call,ASM:Asm,mode:'detached'|'handle'|'await'='detached'){
        const func = call.func
        if(!func?.isAsync||!func.asyncWorkerName){
            throw new Error('Async call target is not an async function')
        }
        if(call.methodInstance||call.prototypeMethod){
            throw new Error('Async class and prototype methods are not supported')
        }
        if(call.params.length!==func.params.length){
            throw new Error(`Async function "${func.name}" expects ${func.params.length} arguments, received ${call.params.length}`)
        }
        const id = ++asyncCallId
        const allocationFailure = `__ds_async_alloc_failure_${id}`
        const createFailure = `__ds_async_create_failure_${id}`
        const waitFailure = `__ds_async_wait_failure_${id}`
        const done = `__ds_async_call_done_${id}`
        const hasParams = call.params.length>0

        ASM.markBackgroundThreads()
        ASM.addImport('kernel32','CreateThread')
        ASM.addImport('kernel32','CloseHandle')
        ASM.addImport('kernel32','ExitProcess')
        ASM.addCode('push rbx')
        if(hasParams){
            ASM.addImport('msvcrt','malloc')
            ASM.addCode(`mov rcx, ${call.params.length*8}`)
            ASM.addCode('sub rsp, 32')
            ASM.addCode('call [malloc]')
            ASM.addCode('add rsp, 32')
            ASM.addCode('test rax, rax')
            ASM.addCode(`jz ${allocationFailure}`)
            ASM.addCode('mov rbx, rax')
            call.params.forEach((param,index)=>{
                call.emitAsyncArgument(ASM,param,func.params[index],index)
                ASM.addCode(`mov [rbx+${index*8}], rax`)
            })
        }

        ASM.addCode('lock')
        ASM.addCode('inc qword [__ds_active_threads]')
        ASM.addCode('xor ecx, ecx')
        ASM.addCode('xor edx, edx')
        ASM.addCode(`lea r8, [${func.asyncWorkerName}]`)
        ASM.addCode(hasParams?'mov r9, rbx':'xor r9d, r9d')
        ASM.addCode('sub rsp, 48')
        ASM.addCode('mov qword [rsp+32], 0')
        ASM.addCode('mov qword [rsp+40], 0')
        ASM.addCode('call [CreateThread]')
        ASM.addCode('add rsp, 48')
        ASM.addCode('test rax, rax')
        ASM.addCode(`jz ${createFailure}`)

        if(mode==='handle'){
            ASM.addCode('pop rbx')
            ASM.addCode(`jmp ${done}`)
        }else if(mode==='await'){
            ASM.addImport('kernel32','WaitForSingleObject')
            ASM.addCode('mov rbx, rax')
            ASM.addCode('mov rcx, rbx')
            ASM.addCode('mov edx, 0xffffffff')
            ASM.addCode('sub rsp, 32')
            ASM.addCode('call [WaitForSingleObject]')
            ASM.addCode('add rsp, 32')
            ASM.addCode('test eax, eax')
            ASM.addCode(`jnz ${waitFailure}`)
        }else{
            ASM.addCode('mov rcx, rax')
        }
        if(mode!=='handle'){
            ASM.addCode('sub rsp, 32')
            ASM.addCode('call [CloseHandle]')
            ASM.addCode('add rsp, 32')
            ASM.addCode('pop rbx')
            ASM.addCode(`jmp ${done}`)
        }

        ASM.addCode(`${allocationFailure}:`)
        call.emitAsyncFailure(ASM)
        ASM.addCode(`jmp ${done}`)
        ASM.addCode(`${createFailure}:`)
        ASM.addCode('lock')
        ASM.addCode('dec qword [__ds_active_threads]')
        if(hasParams){
            ASM.addImport('msvcrt','free')
            ASM.addCode('mov rcx, rbx')
            ASM.addCode('sub rsp, 32')
            ASM.addCode('call [free]')
            ASM.addCode('add rsp, 32')
        }
        call.emitAsyncFailure(ASM)
        ASM.addCode(`jmp ${done}`)
        if(mode==='await'){
            ASM.addCode(`${waitFailure}:`)
            call.emitAsyncFailure(ASM)
            ASM.addCode(`jmp ${done}`)
        }
        ASM.addCode(`${done}:`)
    }

export function emitAsyncArgument(call:Call,ASM:Asm,param:FunctionArgument,expected:{name:string,type:string,dynamicArray?:boolean},index:number){
        if(param.tempName){
            ASM.addCode(`mov rax, [${param.tempName}]`)
            return
        }
        if(param.arrayPointerName){
            ASM.addCode(`mov rax, [${param.arrayPointerName}]`)
            return
        }
        if(param.value instanceof DataElement){
            const value = param.value
            if(value.isArray){
                if(expected.dynamicArray){
                    ASM.addCode(value.isParameter
                        ? `mov rax, ${value.name}`
                        : `lea rax, [${value.name}]`)
                }else if(value.dynamicArray){
                    ASM.addCode(`mov rax, [${value.name}]`)
                }else{
                    ASM.addCode(`lea rax, [${value.name}]`)
                }
                return
            }
            if(param.classPropertyInstance&&param.classProperty?.type==='string'){
                ASM.addCode(`mov rax, [${param.getClassPropertyAccessName()}]`)
            }else if(value.type==='string'){
                if(value.isReferenceAlias){
                    ASM.addCode(`mov rdx, [${value.name}]`)
                    ASM.addCode('mov rax, [rdx]')
                }else if(value.isParameter){
                    ASM.addCode(`mov rax, ${value.name}`)
                }else{
                    ASM.addCode(`mov rax, [${value.name}]`)
                }
            }else if(value.classType&&!value.isParameter){
                ASM.addCode(value.isProcedureLocal&&value.isHeapAllocated
                    ? `mov rax, [${value.name}]`
                    : `lea rax, [${value.name}]`)
            }else{
                ASM.addCode(`mov rax, [${value.name}]`)
            }
            return
        }
        if(param.value instanceof FuncElement){
            ASM.addCode(`lea rax, [${param.value.name}]`)
            return
        }
        if(typeof param.value==='string'){
            const literal = param.value.match(/^(['"])([\s\S]*)\1$/)
            if(literal){
                const label = `__ds_async_string_${asyncCallId}_${index}`
                ASM.addData(`${label} ${stringData(literal[2])}`)
                ASM.addCode(`lea rax, [${label}]`)
                return
            }
        }
        throw new Error(`Unable to resolve argument ${index+1} for async function "${call.func?.name}"`)
    }

export function emitAsyncFailure(call:Call,ASM:Asm){
        ASM.addCode('mov ecx, 1')
        ASM.addCode('sub rsp, 32')
        ASM.addCode('call [ExitProcess]')
        ASM.addCode('add rsp, 32')
    }
