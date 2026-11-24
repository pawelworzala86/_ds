import Asm from '../../asm.ts'
import {stringLiteralData} from '../../stringLiteral.ts'
import type {Call} from '../call.ts'

let stringTransformId = 0

const caseMethods = new Set([
    'toUpperCase',
    'toLowerCase',
    'toLocaleUpperCase',
    'toLocaleLowerCase'
])

export function emitStringTransform(call:Call,ASM:Asm){
    const string = call.builtinStringTransform
    const method = call.builtinStringTransformMethod
    if(!string||!method){
        throw new Error('String transformation is not initialized')
    }

    const sourceValue = string.getCode(true)
    if(sourceValue===null){
        throw new Error('Unable to resolve String transformation receiver')
    }
    const repeatCount = method==='repeat'?call.params[0]:null
    const repeatCountValue = repeatCount?.getCode(true)
    if(method==='repeat'&&(!repeatCount||repeatCountValue===null||repeatCountValue===undefined)){
        throw new Error('Unable to resolve String.repeat count')
    }

    const id = ++stringTransformId
    const helperName = `__ds_string_transform_${id}`
    const source = `__ds_string_transform_${id}_source`
    const sourceLength = `__ds_string_transform_${id}_source_length`
    const output = `__ds_string_transform_${id}_output`
    const outputLength = `__ds_string_transform_${id}_output_length`
    const start = `__ds_string_transform_${id}_start`
    const end = `__ds_string_transform_${id}_end`
    const index = `__ds_string_transform_${id}_index`
    const count = `__ds_string_transform_${id}_count`
    const allocationFailure = `__ds_string_transform_${id}_allocation_failure`
    const negativeCount = `__ds_string_transform_${id}_negative_count`
    const overflow = `__ds_string_transform_${id}_overflow`
    const done = `__ds_string_transform_${id}_done`
    const isRepeat = method==='repeat'
    const isUpper = method==='toUpperCase'||method==='toLocaleUpperCase'
    const trimStart = method==='trim'||method==='trimStart'
    const trimEnd = method==='trim'||method==='trimEnd'
    const caseConvert = caseMethods.has(method)
    const sourceLiteral = `__ds_string_transform_${id}_source_literal`
    let sourceArgument = sourceValue

    if(typeof sourceArgument==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(sourceArgument)){
        ASM.addData(`${sourceLiteral} ${stringLiteralData(sourceArgument)}`)
        sourceArgument = `addr ${sourceLiteral}`
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
    const helper = [
        `proc ${helperName}`,
        `local ${source} dq 0`,
        `local ${sourceLength} dq 0`,
        `local ${output} dq 0`,
        `local ${outputLength} dq 0`,
        `local ${start} dq 0`,
        `local ${end} dq 0`,
        `local ${index} dq 0`,
        ...(isRepeat?[`local ${count} dq 0`]:[]),
        `mov [${source}], rcx`,
        ...(isRepeat?[`mov [${count}], rdx`]:[]),
        `mov rcx, [${source}]`,
        'sub rsp, 40',
        'call [strlen]',
        'add rsp, 40',
        `mov [${sourceLength}], rax`,
        ...(isRepeat?[
            `cmp qword [${count}], 0`,
            `jl ${negativeCount}`,
            `cmp qword [${sourceLength}], 0`,
            `je ${helperName}_empty_repeat_source`,
            'mov rax, 0x7ffffffffffffffe',
            'xor edx, edx',
            `mov rcx, [${sourceLength}]`,
            'div rcx',
            `cmp rax, [${count}]`,
            `jl ${overflow}`,
            `mov rax, [${sourceLength}]`,
            `imul rax, [${count}]`,
            `mov [${outputLength}], rax`,
            `jmp ${helperName}_repeat_length_ready`,
            `${helperName}_empty_repeat_source:`,
            `mov qword [${outputLength}], 0`,
            `${helperName}_repeat_length_ready:`
        ]:[
            `mov qword [${start}], 0`,
            `mov rax, [${sourceLength}]`,
            `mov [${end}], rax`,
            ...(trimStart?[
                `${helperName}_trim_start_loop:`,
                `mov rax, [${start}]`,
                `cmp rax, [${end}]`,
                `jnb ${helperName}_trim_start_done`,
                `mov rdx, [${source}]`,
                'add rdx, rax',
                'movzx eax, byte [rdx]',
                'cmp eax, 32',
                `je ${helperName}_trim_start_advance`,
                'cmp eax, 9',
                `je ${helperName}_trim_start_advance`,
                'cmp eax, 10',
                `je ${helperName}_trim_start_advance`,
                'cmp eax, 11',
                `je ${helperName}_trim_start_advance`,
                'cmp eax, 12',
                `je ${helperName}_trim_start_advance`,
                'cmp eax, 13',
                `jne ${helperName}_trim_start_done`,
                `${helperName}_trim_start_advance:`,
                `inc qword [${start}]`,
                `jmp ${helperName}_trim_start_loop`,
                `${helperName}_trim_start_done:`
            ]:[]),
            ...(trimEnd?[
                `${helperName}_trim_end_loop:`,
                `mov rax, [${end}]`,
                `cmp rax, [${start}]`,
                `jbe ${helperName}_trim_end_done`,
                'dec rax',
                `mov rdx, [${source}]`,
                'add rdx, rax',
                'movzx eax, byte [rdx]',
                'cmp eax, 32',
                `je ${helperName}_trim_end_advance`,
                'cmp eax, 9',
                `je ${helperName}_trim_end_advance`,
                'cmp eax, 10',
                `je ${helperName}_trim_end_advance`,
                'cmp eax, 11',
                `je ${helperName}_trim_end_advance`,
                'cmp eax, 12',
                `je ${helperName}_trim_end_advance`,
                'cmp eax, 13',
                `jne ${helperName}_trim_end_done`,
                `${helperName}_trim_end_advance:`,
                `dec qword [${end}]`,
                `jmp ${helperName}_trim_end_loop`,
                `${helperName}_trim_end_done:`
            ]:[]),
            `mov rax, [${end}]`,
            `sub rax, [${start}]`,
            `mov [${outputLength}], rax`
        ]),
        `mov rax, [${outputLength}]`,
        'inc rax',
        'mov rcx, rax',
        'sub rsp, 40',
        'call [malloc]',
        'add rsp, 40',
        'test rax, rax',
        `jz ${allocationFailure}`,
        `mov [${output}], rax`,
        `mov rcx, [${output}]`,
        `mov rdx, [${source}]`,
        ...(isRepeat?[]:[`add rdx, [${start}]`]),
        `mov r8, [${outputLength}]`,
        'test r8, r8',
        `jz ${helperName}_terminate`,
        ...(isRepeat?[
            `mov qword [${index}], 0`,
            `${helperName}_repeat_loop:`,
            `mov rax, [${index}]`,
            `cmp rax, [${count}]`,
            `jnb ${helperName}_terminate`,
            `mov rax, [${index}]`,
            `imul rax, [${sourceLength}]`,
            `mov rcx, [${output}]`,
            'add rcx, rax',
            `mov rdx, [${source}]`,
            `mov r8, [${sourceLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            `inc qword [${index}]`,
            `jmp ${helperName}_repeat_loop`
        ]:[
            `mov rcx, [${output}]`,
            `mov rdx, [${source}]`,
            `add rdx, [${start}]`,
            `mov r8, [${outputLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            ...(caseConvert?[
                `mov qword [${index}], 0`,
                `${helperName}_case_loop:`,
                `mov rax, [${index}]`,
                `cmp rax, [${outputLength}]`,
                `jnb ${helperName}_terminate`,
                `mov rdx, [${output}]`,
                'add rdx, rax',
                'movzx eax, byte [rdx]',
                ...(isUpper?[
                    'cmp eax, 97',
                    `jb ${helperName}_case_next`,
                    'cmp eax, 122',
                    `ja ${helperName}_case_next`,
                    'sub al, 32'
                ]:[
                    'cmp eax, 65',
                    `jb ${helperName}_case_next`,
                    'cmp eax, 90',
                    `ja ${helperName}_case_next`,
                    'add al, 32'
                ]),
                'mov byte [rdx], al',
                `${helperName}_case_next:`,
                `inc qword [${index}]`,
                `jmp ${helperName}_case_loop`
            ]:[])
        ]),
        `${helperName}_terminate:`,
        `mov rax, [${output}]`,
        `add rax, [${outputLength}]`,
        'mov byte [rax], 0',
        `mov rax, [${output}]`,
        `jmp ${done}`,
        `${negativeCount}:`,
        `${overflow}:`,
        'mov ecx, 1',
        'sub rsp, 40',
        'call [ExitProcess]',
        'add rsp, 40',
        `jmp ${overflow}`,
        `${allocationFailure}:`,
        'mov ecx, 1',
        'sub rsp, 40',
        'call [ExitProcess]',
        'add rsp, 40',
        `${done}:`,
        'ret',
        'endp'
    ].join('\n')
    ASM.addProc(helper)

    emitPointer('rcx',sourceArgument)
    if(isRepeat){
        if(repeatCountValue!.startsWith('addr ')){
            throw new Error('String.repeat count must be an integer')
        }
        ASM.addCode(`mov rdx, ${repeatCountValue}`)
    }
    ASM.addCode('sub rsp, 40')
    ASM.addCode(`call ${helperName}`)
    ASM.addCode('add rsp, 40')
}
