import Asm from '../../asm.ts'
import {stringLiteralData} from '../../stringLiteral.ts'
import type {Call} from '../call.ts'
import type FunctionArgument from '../functionArgument.ts'
import DataElement from '../dataElement.ts'

let stringConcatId = 0

export function emitStringConcatOperands(string:DataElement,addition:FunctionArgument,ASM:Asm){
        const stringValue = string.getCode(true)
        const additionValue = addition.getCode(true)
        if(stringValue===null||additionValue===null){
            throw new Error('Unable to resolve string concatenation arguments')
        }

        const id = ++stringConcatId
        const allocationFailure = `__ds_string_concat_${id}_allocation_failure`
        const allocationReady = `__ds_string_concat_${id}_allocation_ready`

        let additionArgument = additionValue
        if(typeof addition.value==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(addition.value)){
            const label = `__ds_string_concat_argument_${id}`
            ASM.addData(`${label} ${stringLiteralData(addition.value)}`)
            additionArgument = `addr ${label}`
        }
        const emitPointer = (register:string,value:string)=>{
            if(value.startsWith('addr ')){
                ASM.addCode(`lea ${register}, [${value.replace(/^addr\s+/,'')}]`)
            }else{
                ASM.addCode(`mov ${register}, ${value}`)
            }
        }

        ASM.addImport('msvcrt','malloc')
        ASM.addImport('msvcrt','memcpy')
        ASM.addImport('msvcrt','strlen')
        ASM.addImport('kernel32','ExitProcess')
        ASM.addCode('sub rsp, 48')
        emitPointer('rcx',stringValue)
        ASM.addCode('mov [rsp], rcx')
        emitPointer('rdx',additionArgument)
        ASM.addCode('mov [rsp+8], rdx')
        ASM.addCode('mov rcx, [rsp]')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [strlen]')
        ASM.addCode('add rsp, 40')
        ASM.addCode('mov [rsp+16], rax')
        ASM.addCode('mov rcx, [rsp+8]')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [strlen]')
        ASM.addCode('add rsp, 40')
        ASM.addCode('mov [rsp+24], rax')
        ASM.addCode('add rax, [rsp+16]')
        ASM.addCode('inc rax')
        ASM.addCode('mov rcx, rax')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [malloc]')
        ASM.addCode('add rsp, 40')
        ASM.addCode('test rax, rax')
        ASM.addCode(`jnz ${allocationReady}`)
        ASM.addCode(`${allocationFailure}:`)
        ASM.addCode('mov ecx, 1')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [ExitProcess]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`jmp ${allocationFailure}`)
        ASM.addCode(`${allocationReady}:`)
        ASM.addCode('mov [rsp+32], rax')
        ASM.addCode('mov rcx, rax')
        ASM.addCode('mov rdx, [rsp]')
        ASM.addCode('mov r8, [rsp+16]')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [memcpy]')
        ASM.addCode('add rsp, 40')
        ASM.addCode('mov rcx, [rsp+32]')
        ASM.addCode('add rcx, [rsp+16]')
        ASM.addCode('mov rdx, [rsp+8]')
        ASM.addCode('mov r8, [rsp+24]')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [memcpy]')
        ASM.addCode('add rsp, 40')
        ASM.addCode('mov rax, [rsp+32]')
        ASM.addCode('add rax, [rsp+16]')
        ASM.addCode('add rax, [rsp+24]')
        ASM.addCode('mov byte [rax], 0')
        ASM.addCode('mov rax, [rsp+32]')
        ASM.addCode('add rsp, 48')
    }

export function emitStringConcat(call:Call,ASM:Asm){
        const string = call.builtinStringConcat
        const addition = call.params[0]
        if(!string||!addition){
            throw new Error('String.concat is not initialized')
        }
        emitStringConcatOperands(string,addition,ASM)
    }
