import Asm from '../../asm.ts'
import {stringLiteralData} from '../../stringLiteral.ts'
import type {Call} from '../call.ts'

let stringConcatId = 0

export function emitStringConcat(call:Call,ASM:Asm){
        const string = call.builtinStringConcat
        const addition = call.params[0]
        if(!string||!addition){
            throw new Error('String.concat is not initialized')
        }
        const stringValue = string.getCode(true)
        const additionValue = addition.getCode(true)
        if(stringValue===null||additionValue===null){
            throw new Error('Unable to resolve String.concat arguments')
        }

        const id = ++stringConcatId
        const helperName = `__ds_string_concat_${id}`
        const source = `__ds_string_concat_${id}_source`
        const additionPointer = `__ds_string_concat_${id}_addition`
        const sourceLength = `__ds_string_concat_${id}_source_length`
        const additionLength = `__ds_string_concat_${id}_addition_length`
        const output = `__ds_string_concat_${id}_output`
        const allocationFailure = `__ds_string_concat_${id}_allocation_failure`

        ASM.addImport('msvcrt','malloc')
        ASM.addImport('msvcrt','memcpy')
        ASM.addImport('msvcrt','strlen')
        ASM.addImport('kernel32','ExitProcess')
        ASM.addProc([
            `proc ${helperName}`,
            `local ${source} dq 0`,
            `local ${additionPointer} dq 0`,
            `local ${sourceLength} dq 0`,
            `local ${additionLength} dq 0`,
            `local ${output} dq 0`,
            `mov [${source}], rcx`,
            `mov [${additionPointer}], rdx`,
            `mov rcx, [${source}]`,
            'sub rsp, 40',
            'call [strlen]',
            'add rsp, 40',
            `mov [${sourceLength}], rax`,
            `mov rcx, [${additionPointer}]`,
            'sub rsp, 40',
            'call [strlen]',
            'add rsp, 40',
            `mov [${additionLength}], rax`,
            `add rax, [${sourceLength}]`,
            'inc rax',
            'mov rcx, rax',
            'sub rsp, 40',
            'call [malloc]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${allocationFailure}`,
            `mov [${output}], rax`,
            `mov rcx, rax`,
            `mov rdx, [${source}]`,
            `mov r8, [${sourceLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            `mov rcx, [${output}]`,
            `add rcx, [${sourceLength}]`,
            `mov rdx, [${additionPointer}]`,
            `mov r8, [${additionLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            `mov rax, [${output}]`,
            `add rax, [${sourceLength}]`,
            `add rax, [${additionLength}]`,
            'mov byte [rax], 0',
            `mov rax, [${output}]`,
            `jmp ${helperName}_done`,
            `${allocationFailure}:`,
            'mov ecx, 1',
            'sub rsp, 40',
            'call [ExitProcess]',
            'add rsp, 40',
            `jmp ${allocationFailure}`,
            `${helperName}_done:`,
            'ret',
            'endp'
        ].join('\n'))

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
        emitPointer('rcx',stringValue)
        emitPointer('rdx',additionArgument)
        ASM.addCode('sub rsp, 40')
        ASM.addCode(`call ${helperName}`)
        ASM.addCode('add rsp, 40')
    }
