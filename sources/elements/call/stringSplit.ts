import Asm from '../../asm.ts'
import {stringLiteralData} from '../../stringLiteral.ts'
import {compileRegExpLiteral,parseRegExpLiteral} from '../../regex.ts'
import type {Call} from '../call.ts'

let stringSplitId = 0

export function emitStringSplit(call:Call,ASM:Asm){
        const string = call.builtinStringSplit
        const separator = call.params[0]
        if(!string||!separator){
            throw new Error('String.split is not initialized')
        }
        const stringValue = string.getCode(true)
        const separatorValue = separator.getCode(true)
        if(stringValue===null||separatorValue===null){
            throw new Error('Unable to resolve String.split arguments')
        }

        const id = ++stringSplitId
        const regexpLiteral = typeof separator.value==='string'&&parseRegExpLiteral(separator.value)
            ? separator.value
            : null
        const compiledRegExp = regexpLiteral?compileRegExpLiteral(regexpLiteral):null
        const helperName = `__ds_string_split_${id}`
        const source = `__ds_split_${id}_source`
        const separatorPointer = `__ds_split_${id}_separator`
        const sourceLength = `__ds_split_${id}_source_length`
        const separatorLength = `__ds_split_${id}_separator_length`
        const index = `__ds_split_${id}_index`
        const segmentStart = `__ds_split_${id}_segment_start`
        const segmentLength = `__ds_split_${id}_segment_length`
        const result = `__ds_split_${id}_result`
        const items = `__ds_split_${id}_items`
        const capacity = `__ds_split_${id}_capacity`
        const count = `__ds_split_${id}_count`
        const segment = `__ds_split_${id}_segment`
        const matchPointer = `__ds_split_${id}_match_pointer`
        const resume = `__ds_split_${id}_resume`
        const mainLoop = `__ds_split_${id}_main_loop`
        const matched = `__ds_split_${id}_matched`
        const finalSegment = `__ds_split_${id}_final_segment`
        const emptySeparator = `__ds_split_${id}_empty_separator`
        const emptyLoop = `__ds_split_${id}_empty_loop`
        const appendSegment = `__ds_split_${id}_append_segment`
        const appendDispatch = `__ds_split_${id}_append_dispatch`
        const appendCapture = `__ds_split_${id}_append_capture`
        const afterMatch = `__ds_split_${id}_after_match`
        const afterFinal = `__ds_split_${id}_after_final`
        const afterEmpty = `__ds_split_${id}_after_empty`
        const done = `__ds_split_${id}_done`
        const allocationFailure = `__ds_split_${id}_allocation_failure`
        const scanStart = `__ds_split_${id}_scan_start`
        const scanPosition = `__ds_split_${id}_scan_position`
        const dfaState = `__ds_split_${id}_dfa_state`
        const lastMatchEnd = `__ds_split_${id}_last_match_end`
        const tryMatchStart = `__ds_split_${id}_try_match_start`
        const consumeMatch = `__ds_split_${id}_consume_match`
        const matchFinished = `__ds_split_${id}_match_finished`
        const recordMatch = `__ds_split_${id}_record_match`
        const matchFound = `__ds_split_${id}_match_found`
        const transitionTable = `__ds_split_${id}_transition_table`
        const transitionTableSize = compiledRegExp?compiledRegExp.transitions.length*256:0
        const transitionInitializers = compiledRegExp?.transitions.flatMap((row,state)=>
            row.flatMap((target,character)=>target===0?[]:[
                `mov rax, [${transitionTable}]`,
                `mov byte [rax+${state*256+character}], ${target}`
            ])
        )??[]
        const acceptingTransitions = compiledRegExp?.acceptingStates.flatMap(state=>[
            `cmp qword [${dfaState}], ${state}`,
            `je ${recordMatch}`
        ])??[]
        const regexpMatcher = compiledRegExp?[
            `mov rax, [${index}]`,
            `mov [${scanStart}], rax`,
            `${tryMatchStart}:`,
            `mov rax, [${scanStart}]`,
            `cmp rax, [${sourceLength}]`,
            `jnb ${finalSegment}`,
            `mov [${scanPosition}], rax`,
            `mov qword [${dfaState}], 1`,
            `mov qword [${lastMatchEnd}], -1`,
            `${consumeMatch}:`,
            `mov rax, [${scanPosition}]`,
            `cmp rax, [${sourceLength}]`,
            `jnb ${matchFinished}`,
            `mov rdx, [${source}]`,
            `add rdx, rax`,
            'movzx eax, byte [rdx]',
            `mov rdx, [${dfaState}]`,
            'shl rdx, 8',
            `mov r8, [${transitionTable}]`,
            'add rdx, r8',
            'add rdx, rax',
            'movzx eax, byte [rdx]',
            'test eax, eax',
            `jz ${matchFinished}`,
            `mov [${dfaState}], rax`,
            `inc qword [${scanPosition}]`,
            ...acceptingTransitions,
            `jmp ${consumeMatch}`,
            `${recordMatch}:`,
            `mov rax, [${scanPosition}]`,
            `mov [${lastMatchEnd}], rax`,
            `jmp ${consumeMatch}`,
            `${matchFinished}:`,
            `cmp qword [${lastMatchEnd}], -1`,
            `jne ${matchFound}`,
            `inc qword [${scanStart}]`,
            `jmp ${tryMatchStart}`,
            `${matchFound}:`,
            `mov rax, [${source}]`,
            `add rax, [${scanStart}]`,
            `mov [${matchPointer}], rax`,
            `mov rax, [${lastMatchEnd}]`,
            `sub rax, [${scanStart}]`,
            `mov [${separatorLength}], rax`,
            `jmp ${matched}`
        ]:[
            `mov rcx, [${source}]`,
            `add rcx, [${index}]`,
            `mov rdx, [${separatorPointer}]`,
            'sub rsp, 40',
            'call [strstr]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${finalSegment}`,
            `mov [${matchPointer}], rax`
        ]

        ASM.addImport('msvcrt','malloc')
        ASM.addImport('msvcrt','memset')
        ASM.addImport('msvcrt','memcpy')
        ASM.addImport('msvcrt','strlen')
        if(compiledRegExp){
            ASM.addImport('msvcrt','free')
        }
        if(!compiledRegExp){
            ASM.addImport('msvcrt','strstr')
        }
        ASM.addImport('kernel32','ExitProcess')
        const helper = [
            `proc ${helperName}`,
            `local ${source} dq 0`,
            `local ${separatorPointer} dq 0`,
            `local ${sourceLength} dq 0`,
            `local ${separatorLength} dq 0`,
            `local ${index} dq 0`,
            `local ${segmentStart} dq 0`,
            `local ${segmentLength} dq 0`,
            `local ${result} dq 0`,
            `local ${items} dq 0`,
            `local ${capacity} dq 0`,
            `local ${count} dq 0`,
            `local ${segment} dq 0`,
            `local ${matchPointer} dq 0`,
            `local ${resume} dq 0`,
            ...(compiledRegExp?[
                `local ${scanStart} dq 0`,
                `local ${scanPosition} dq 0`,
                `local ${dfaState} dq 0`,
                `local ${lastMatchEnd} dq 0`,
                `local ${transitionTable} dq 0`
            ]:[]),
            `mov [${source}], rcx`,
            `mov [${separatorPointer}], rdx`,
            `mov rcx, [${source}]`,
            'sub rsp, 40',
            'call [strlen]',
            'add rsp, 40',
            `mov [${sourceLength}], rax`,
            `mov rcx, [${separatorPointer}]`,
            'sub rsp, 40',
            'call [strlen]',
            'add rsp, 40',
            `mov [${separatorLength}], rax`,
            ...(compiledRegExp?[
                `mov rcx, ${transitionTableSize}`,
                'sub rsp, 40',
                'call [malloc]',
                'add rsp, 40',
                'test rax, rax',
                `jz ${allocationFailure}`,
                `mov [${transitionTable}], rax`,
                'mov rcx, rax',
                'xor edx, edx',
                `mov r8, ${transitionTableSize}`,
                'sub rsp, 40',
                'call [memset]',
                'add rsp, 40',
                ...transitionInitializers
            ]:[]),
            'mov rcx, 24',
            'sub rsp, 40',
            'call [malloc]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${allocationFailure}`,
            `mov [${result}], rax`,
            `mov rax, [${sourceLength}]`,
            'inc rax',
            ...(compiledRegExp?.capturesWholeSeparator?['shl rax, 1']:[]),
            `mov [${capacity}], rax`,
            'shl rax, 3',
            'mov rcx, rax',
            'sub rsp, 40',
            'call [malloc]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${allocationFailure}`,
            `mov [${items}], rax`,
            `mov rdx, [${result}]`,
            `mov [rdx], rax`,
            `mov rax, [${capacity}]`,
            `mov [rdx+16], rax`,
            `mov qword [rdx+8], 0`,
            `mov qword [${index}], 0`,
            `mov qword [${segmentStart}], 0`,
            `mov qword [${count}], 0`,
            `cmp qword [${separatorLength}], 0`,
            compiledRegExp?`jmp ${mainLoop}`:`je ${emptySeparator}`,
            `${mainLoop}:`,
            `mov rax, [${index}]`,
            `cmp rax, [${sourceLength}]`,
            `jnb ${finalSegment}`,
            ...regexpMatcher,
            `${matched}:`,
            `mov rax, [${matchPointer}]`,
            `sub rax, [${source}]`,
            `mov [${index}], rax`,
            `mov rax, [${index}]`,
            `sub rax, [${segmentStart}]`,
            `mov [${segmentLength}], rax`,
            `mov qword [${resume}], 0`,
            `jmp ${appendSegment}`,
            `${afterMatch}:`,
            `mov rax, [${index}]`,
            `add rax, [${separatorLength}]`,
            `mov [${index}], rax`,
            `mov [${segmentStart}], rax`,
            `jmp ${mainLoop}`,
            `${finalSegment}:`,
            `mov rax, [${sourceLength}]`,
            `sub rax, [${segmentStart}]`,
            `mov [${segmentLength}], rax`,
            `mov qword [${resume}], 1`,
            `jmp ${appendSegment}`,
            `${afterFinal}:`,
            `jmp ${done}`,
            `${emptySeparator}:`,
            `cmp qword [${sourceLength}], 0`,
            `je ${done}`,
            `mov qword [${index}], 0`,
            `${emptyLoop}:`,
            `mov rax, [${index}]`,
            `cmp rax, [${sourceLength}]`,
            `jnb ${done}`,
            `mov [${segmentStart}], rax`,
            `mov qword [${segmentLength}], 1`,
            `mov qword [${resume}], 2`,
            `jmp ${appendSegment}`,
            `${afterEmpty}:`,
            `inc qword [${index}]`,
            `jmp ${emptyLoop}`,
            `${appendSegment}:`,
            `mov rcx, [${segmentLength}]`,
            'inc rcx',
            'sub rsp, 40',
            'call [malloc]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${allocationFailure}`,
            `mov [${segment}], rax`,
            `mov rcx, [${segment}]`,
            `mov rdx, [${source}]`,
            `add rdx, [${segmentStart}]`,
            `mov r8, [${segmentLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            `${appendDispatch}:`,
            `mov rcx, [${segment}]`,
            `add rcx, [${segmentLength}]`,
            'xor edx, edx',
            'mov r8, 1',
            'sub rsp, 40',
            'call [memset]',
            'add rsp, 40',
            `mov rax, [${count}]`,
            'shl rax, 3',
            `mov rdx, [${items}]`,
            'add rdx, rax',
            `mov rcx, [${segment}]`,
            'mov [rdx], rcx',
            `inc qword [${count}]`,
            `cmp qword [${resume}], 0`,
            `je ${compiledRegExp?.capturesWholeSeparator?appendCapture:afterMatch}`,
            `cmp qword [${resume}], 1`,
            `je ${afterFinal}`,
            `jmp ${afterEmpty}`,
            ...(compiledRegExp?.capturesWholeSeparator?[
                `${appendCapture}:`,
                `mov rcx, [${separatorLength}]`,
                'inc rcx',
                'sub rsp, 40',
                'call [malloc]',
                'add rsp, 40',
                'test rax, rax',
                `jz ${allocationFailure}`,
                `mov [${segment}], rax`,
                `mov rcx, [${segment}]`,
                `mov rdx, [${source}]`,
                `add rdx, [${index}]`,
                `mov r8, [${separatorLength}]`,
                'sub rsp, 40',
                'call [memcpy]',
                'add rsp, 40',
                `mov rcx, [${segment}]`,
                `add rcx, [${separatorLength}]`,
                'xor edx, edx',
                'mov r8, 1',
                'sub rsp, 40',
                'call [memset]',
                'add rsp, 40',
                `mov rax, [${count}]`,
                'shl rax, 3',
                `mov rdx, [${items}]`,
                'add rdx, rax',
                `mov rcx, [${segment}]`,
                'mov [rdx], rcx',
                `inc qword [${count}]`,
                `jmp ${afterMatch}`
            ]:[]),
            `${allocationFailure}:`,
            'mov ecx, 1',
            'sub rsp, 40',
            'call [ExitProcess]',
            'add rsp, 40',
            `jmp ${allocationFailure}`,
            `${done}:`,
            `mov rdx, [${result}]`,
            `mov rax, [${count}]`,
            `mov [rdx+8], rax`,
            ...(compiledRegExp?[
                `mov rcx, [${transitionTable}]`,
                'sub rsp, 40',
                'call [free]',
                'add rsp, 40'
            ]:[]),
            `mov rax, [${result}]`,
            'ret',
            'endp'
        ].join('\n')
        ASM.addProc(helper)

        let separatorArgument = separatorValue
        if(compiledRegExp){
            const label = `__ds_string_split_separator_${id}`
            ASM.addData(`${label} db 0`)
            separatorArgument = `addr ${label}`
        }else if(typeof separator.value==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(separator.value)){
            const label = `__ds_string_split_separator_${id}`
            ASM.addData(`${label} ${stringLiteralData(separator.value)}`)
            separatorArgument = `addr ${label}`
        }
        const emitPointer = (register:string,value:string)=>{
            if(value.startsWith('addr ')){
                ASM.addCode(`lea ${register}, [${value.replace(/^addr\s+/,'')}]`)
            }else{
                ASM.addCode(`mov ${register}, ${value}`)
            }
        }
        emitPointer('rcx',stringValue)
        emitPointer('rdx',separatorArgument)
        ASM.addCode('sub rsp, 40')
        ASM.addCode(`call ${helperName}`)
        ASM.addCode('add rsp, 40')
    }
