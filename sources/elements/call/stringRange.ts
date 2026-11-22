import Asm from '../../asm.ts'
import type {Call} from '../call.ts'

let stringRangeId = 0

export function emitStringRange(call:Call,ASM:Asm){
        const string = call.builtinStringRange
        const method = call.builtinStringRangeMethod
        const start = call.params[0]
        const end = call.params[1]
        if(!string||!method||!start){
            throw new Error('String range method is not initialized')
        }
        const stringValue = string.getCode(true)
        const startValue = start.getCode(true)
        const endValue = end?.getCode(true)
        if(stringValue===null||startValue===null||end&&endValue===null){
            throw new Error('Unable to resolve String range arguments')
        }

        const id = ++stringRangeId
        const helperName = `__ds_string_range_${id}`
        const source = `__ds_string_range_${id}_source`
        const startIndex = `__ds_string_range_${id}_start`
        const endIndex = `__ds_string_range_${id}_end`
        const sourceLength = `__ds_string_range_${id}_source_length`
        const output = `__ds_string_range_${id}_output`
        const outputLength = `__ds_string_range_${id}_output_length`
        const normalized = `__ds_string_range_${id}_normalized`
        const allocationFailure = `__ds_string_range_${id}_allocation_failure`
        const done = `__ds_string_range_${id}_done`
        const clampStart = `__ds_string_range_${id}_clamp_start`
        const startDone = `__ds_string_range_${id}_start_done`
        const clampEnd = `__ds_string_range_${id}_clamp_end`
        const endDone = `__ds_string_range_${id}_end_done`
        const startRangeDone = `__ds_string_range_${id}_start_range_done`
        const endRangeDone = `__ds_string_range_${id}_end_range_done`
        const negativeStart = `__ds_string_range_${id}_negative_start`
        const negativeEnd = `__ds_string_range_${id}_negative_end`
        const clampNegativeStart = `__ds_string_range_${id}_clamp_negative_start`
        const clampNegativeEnd = `__ds_string_range_${id}_clamp_negative_end`
        const sliceRangeNonEmpty = `__ds_string_range_${id}_slice_range_non_empty`
        const normalizeStart = method==='slice'?[
            `cmp qword [${startIndex}], 0`,
            `jl ${negativeStart}`,
            `jmp ${clampStart}`,
            `${negativeStart}:`,
            `mov rax, [${sourceLength}]`,
            `add rax, [${startIndex}]`,
            `mov [${startIndex}], rax`
        ]:[]
        const normalizeEnd = method==='slice'?[
            `cmp qword [${endIndex}], 0`,
            `jl ${negativeEnd}`,
            `jmp ${clampEnd}`,
            `${negativeEnd}:`,
            `mov rax, [${sourceLength}]`,
            `add rax, [${endIndex}]`,
            `mov [${endIndex}], rax`
        ]:[]
        const clampRangeStart = [
            `${clampStart}:`,
            `cmp qword [${startIndex}], 0`,
            `jl ${clampNegativeStart}`,
            `jmp ${startDone}`,
            `${clampNegativeStart}:`,
            `mov qword [${startIndex}], 0`,
            `${startDone}:`,
            `mov rax, [${sourceLength}]`,
            `cmp [${startIndex}], rax`,
            `jle ${startRangeDone}`,
            `mov [${startIndex}], rax`,
            `${startRangeDone}:`
        ]
        const clampRangeEnd = end?[
            ...normalizeEnd,
            `${clampEnd}:`,
            `cmp qword [${endIndex}], 0`,
            `jl ${clampNegativeEnd}`,
            `jmp ${endDone}`,
            `${clampNegativeEnd}:`,
            `mov qword [${endIndex}], 0`,
            `${endDone}:`,
            `mov rax, [${sourceLength}]`,
            `cmp [${endIndex}], rax`,
            `jle ${endRangeDone}`,
            `mov [${endIndex}], rax`,
            `${endRangeDone}:`
        ]:[
            `mov rax, [${sourceLength}]`,
            `mov [${endIndex}], rax`
        ]
        const normalizeRange = [
            ...normalizeStart,
            ...clampRangeStart,
            ...clampRangeEnd,
            ...(method==='substring'?[
                `mov rax, [${startIndex}]`,
                `cmp rax, [${endIndex}]`,
                `jle ${normalized}`,
                `mov rdx, [${endIndex}]`,
                `mov [${endIndex}], rax`,
                `mov [${startIndex}], rdx`
            ]:[
                `mov rax, [${startIndex}]`,
                `cmp rax, [${endIndex}]`,
                `jl ${sliceRangeNonEmpty}`,
                `mov [${endIndex}], rax`,
                `${sliceRangeNonEmpty}:`
            ]),
            `${normalized}:`
        ]

        ASM.addImport('msvcrt','malloc')
        ASM.addImport('msvcrt','memcpy')
        ASM.addImport('msvcrt','strlen')
        ASM.addImport('kernel32','ExitProcess')
        ASM.addProc([
            `proc ${helperName}`,
            `local ${source} dq 0`,
            `local ${startIndex} dq 0`,
            `local ${endIndex} dq 0`,
            `local ${sourceLength} dq 0`,
            `local ${output} dq 0`,
            `local ${outputLength} dq 0`,
            `mov [${source}], rcx`,
            `mov [${startIndex}], rdx`,
            `mov [${endIndex}], r8`,
            `mov rcx, [${source}]`,
            'sub rsp, 40',
            'call [strlen]',
            'add rsp, 40',
            `mov [${sourceLength}], rax`,
            ...normalizeRange,
            `mov rax, [${endIndex}]`,
            `sub rax, [${startIndex}]`,
            `mov [${outputLength}], rax`,
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
            `add rdx, [${startIndex}]`,
            `mov r8, [${outputLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            `mov rax, [${output}]`,
            `add rax, [${outputLength}]`,
            'mov byte [rax], 0',
            `mov rax, [${output}]`,
            `jmp ${done}`,
            `${allocationFailure}:`,
            'mov ecx, 1',
            'sub rsp, 40',
            'call [ExitProcess]',
            'add rsp, 40',
            `${done}:`,
            'ret',
            'endp'
        ].join('\n'))

        const emitPointer = (register:string,value:string)=>{
            if(value.startsWith('addr ')){
                ASM.addCode(`lea ${register}, [${value.replace(/^addr\s+/,'')}]`)
            }else{
                ASM.addCode(`mov ${register}, ${value}`)
            }
        }
        emitPointer('rcx',stringValue)
        emitPointer('rdx',startValue)
        if(endValue===null||endValue===undefined){
            ASM.addCode('xor r8d, r8d')
        }else{
            emitPointer('r8',endValue)
        }
        ASM.addCode('sub rsp, 40')
        ASM.addCode(`call ${helperName}`)
        ASM.addCode('add rsp, 40')
    }
