import Asm from '../../asm.ts'
import FuncElement from '../funcElement.ts'
import {stringLiteralData} from '../../stringLiteral.ts'
import {compileRegExpLiteral,parseRegExpLiteral} from '../../regex.ts'
import type {Call} from '../call.ts'

let stringReplaceId = 0

export function emitStringReplace(call:Call,ASM:Asm){
        const string = call.builtinStringReplace
        const search = call.params[0]
        const replacement = call.params[1]
        if(!string||!search||!replacement){
            throw new Error('String.replace is not initialized')
        }
        const stringValue = string.getCode(true)
        const searchValue = search.getCode(true)
        const replacementValue = replacement.getCode(true)
        if(stringValue===null||searchValue===null||replacementValue===null){
            throw new Error('Unable to resolve String.replace arguments')
        }

        const id = ++stringReplaceId
        const regexpLiteral = typeof search.value==='string'&&parseRegExpLiteral(search.value)
            ? search.value
            : null
        const compiledRegExp = regexpLiteral?compileRegExpLiteral(regexpLiteral):null
        const isGlobal = Boolean(regexpLiteral&&parseRegExpLiteral(regexpLiteral)?.flags.includes('g'))
        const helperName = `__ds_string_replace_${id}`
        const source = `__ds_replace_${id}_source`
        const searchPointer = `__ds_replace_${id}_search`
        const replacementPointer = `__ds_replace_${id}_replacement`
        const sourceLength = `__ds_replace_${id}_source_length`
        const searchLength = `__ds_replace_${id}_search_length`
        const replacementLength = `__ds_replace_${id}_replacement_length`
        const output = `__ds_replace_${id}_output`
        const outputCapacity = `__ds_replace_${id}_output_capacity`
        const outputLength = `__ds_replace_${id}_output_length`
        const requiredCapacity = `__ds_replace_${id}_required_capacity`
        const searchStart = `__ds_replace_${id}_search_start`
        const segmentStart = `__ds_replace_${id}_segment_start`
        const segmentLength = `__ds_replace_${id}_segment_length`
        const matchStart = `__ds_replace_${id}_match_start`
        const matchEnd = `__ds_replace_${id}_match_end`
        const matchPointer = `__ds_replace_${id}_match_pointer`
        const callbackMatch = `__ds_replace_${id}_callback_match`
        const callbackMatchLength = `__ds_replace_${id}_callback_match_length`
        const callbackResult = `__ds_replace_${id}_callback_result`
        const afterReplacement = `__ds_replace_${id}_after_replacement`
        const mainLoop = `__ds_replace_${id}_main_loop`
        const matched = `__ds_replace_${id}_matched`
        const noMatch = `__ds_replace_${id}_no_match`
        const copyTail = `__ds_replace_${id}_copy_tail`
        const done = `__ds_replace_${id}_done`
        const allocationFailure = `__ds_replace_${id}_allocation_failure`
        const scanStart = `__ds_replace_${id}_scan_start`
        const scanPosition = `__ds_replace_${id}_scan_position`
        const dfaState = `__ds_replace_${id}_dfa_state`
        const lastMatchEnd = `__ds_replace_${id}_last_match_end`
        const tryMatchStart = `__ds_replace_${id}_try_match_start`
        const consumeMatch = `__ds_replace_${id}_consume_match`
        const matchFinished = `__ds_replace_${id}_match_finished`
        const recordMatch = `__ds_replace_${id}_record_match`
        const matchFound = `__ds_replace_${id}_match_found`
        const transitionTable = `__ds_replace_${id}_transition_table`
        const segmentCapacityReady = `__ds_replace_${id}_segment_capacity_ready`
        const replacementCapacityReady = `__ds_replace_${id}_replacement_capacity_ready`
        const tailCapacityReady = `__ds_replace_${id}_tail_capacity_ready`
        const isCallback = replacement.value instanceof FuncElement
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
            `mov rax, [${searchStart}]`,
            `mov [${scanStart}], rax`,
            `${tryMatchStart}:`,
            `mov rax, [${scanStart}]`,
            `cmp rax, [${sourceLength}]`,
            `jnb ${noMatch}`,
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
            `mov rax, [${scanStart}]`,
            `mov [${matchStart}], rax`,
            `mov rax, [${lastMatchEnd}]`,
            `mov [${matchEnd}], rax`,
            `jmp ${matched}`
        ]:[
            `mov rcx, [${source}]`,
            `add rcx, [${searchStart}]`,
            `mov rdx, [${searchPointer}]`,
            'sub rsp, 40',
            'call [strstr]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${noMatch}`,
            `mov [${matchPointer}], rax`,
            `mov rax, [${matchPointer}]`,
            `sub rax, [${source}]`,
            `mov [${matchStart}], rax`,
            `add rax, [${searchLength}]`,
            `mov [${matchEnd}], rax`,
            `jmp ${matched}`
        ]

        const ensureCapacity = (length:string,label:string)=>isCallback?[
            `mov rax, [${outputLength}]`,
            `add rax, [${length}]`,
            'inc rax',
            `mov [${requiredCapacity}], rax`,
            `cmp rax, [${outputCapacity}]`,
            `jbe ${label}`,
            `mov rcx, [${output}]`,
            `mov rdx, [${requiredCapacity}]`,
            'sub rsp, 40',
            'call [realloc]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${allocationFailure}`,
            `mov [${output}], rax`,
            `mov rax, [${requiredCapacity}]`,
            `mov [${outputCapacity}], rax`,
            `${label}:`
        ]:[]
        const invokeReplacement = isCallback?[
            `mov rax, [${matchEnd}]`,
            `sub rax, [${matchStart}]`,
            `mov [${callbackMatchLength}], rax`,
            'inc rax',
            'mov rcx, rax',
            'sub rsp, 40',
            'call [malloc]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${allocationFailure}`,
            `mov [${callbackMatch}], rax`,
            `mov rcx, rax`,
            `mov rdx, [${source}]`,
            `add rdx, [${matchStart}]`,
            `mov r8, [${callbackMatchLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            `mov rax, [${callbackMatch}]`,
            `add rax, [${callbackMatchLength}]`,
            'mov byte [rax], 0',
            `mov rax, [${callbackMatch}]`,
            'push rax',
            'sub rsp, 32',
            `call [${replacementPointer}]`,
            'add rsp, 40',
            `mov [${callbackResult}], rax`,
            'mov rcx, rax',
            'sub rsp, 40',
            'call [strlen]',
            'add rsp, 40',
            `mov [${replacementLength}], rax`,
            `mov rcx, [${callbackMatch}]`,
            'sub rsp, 40',
            'call [free]',
            'add rsp, 40',
            ...ensureCapacity(replacementLength,replacementCapacityReady),
            `mov rcx, [${output}]`,
            `add rcx, [${outputLength}]`,
            `mov rdx, [${callbackResult}]`,
            `mov r8, [${replacementLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            `mov rax, [${outputLength}]`,
            `add rax, [${replacementLength}]`,
            `mov [${outputLength}], rax`
        ]:[
            `cmp qword [${replacementLength}], 0`,
            `je ${afterReplacement}`,
            `mov rcx, [${output}]`,
            `add rcx, [${outputLength}]`,
            `mov rdx, [${replacementPointer}]`,
            `mov r8, [${replacementLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            `mov rax, [${outputLength}]`,
            `add rax, [${replacementLength}]`,
            `mov [${outputLength}], rax`
        ]

        ASM.addImport('msvcrt','malloc')
        ASM.addImport('msvcrt','memcpy')
        ASM.addImport('msvcrt','strlen')
        if(isCallback){
            ASM.addImport('msvcrt','realloc')
        }
        if(compiledRegExp){
            ASM.addImport('msvcrt','memset')
        }
        if(compiledRegExp||isCallback){
            ASM.addImport('msvcrt','free')
        }
        if(!compiledRegExp){
            ASM.addImport('msvcrt','strstr')
        }
        ASM.addImport('kernel32','ExitProcess')
        const helper = [
            `proc ${helperName}`,
            `local ${source} dq 0`,
            `local ${searchPointer} dq 0`,
            `local ${replacementPointer} dq 0`,
            `local ${sourceLength} dq 0`,
            `local ${searchLength} dq 0`,
            `local ${replacementLength} dq 0`,
            `local ${output} dq 0`,
            `local ${outputCapacity} dq 0`,
            `local ${outputLength} dq 0`,
            ...(isCallback?[`local ${requiredCapacity} dq 0`]:[]),
            `local ${searchStart} dq 0`,
            `local ${segmentStart} dq 0`,
            `local ${segmentLength} dq 0`,
            `local ${matchStart} dq 0`,
            `local ${matchEnd} dq 0`,
            `local ${matchPointer} dq 0`,
            ...(isCallback?[
                `local ${callbackMatch} dq 0`,
                `local ${callbackMatchLength} dq 0`,
                `local ${callbackResult} dq 0`
            ]:[]),
            ...(compiledRegExp?[
                `local ${scanStart} dq 0`,
                `local ${scanPosition} dq 0`,
                `local ${dfaState} dq 0`,
                `local ${lastMatchEnd} dq 0`,
                `local ${transitionTable} dq 0`
            ]:[]),
            `mov [${source}], rcx`,
            `mov [${searchPointer}], rdx`,
            `mov [${replacementPointer}], r8`,
            `mov rcx, [${source}]`,
            'sub rsp, 40',
            'call [strlen]',
            'add rsp, 40',
            `mov [${sourceLength}], rax`,
            `mov rcx, [${searchPointer}]`,
            'sub rsp, 40',
            'call [strlen]',
            'add rsp, 40',
            `mov [${searchLength}], rax`,
            ...(isCallback?[`mov qword [${replacementLength}], 0`]:[
                `mov rcx, [${replacementPointer}]`,
                'sub rsp, 40',
                'call [strlen]',
                'add rsp, 40',
                `mov [${replacementLength}], rax`
            ]),
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
            ...(isCallback?[
                `mov rax, [${sourceLength}]`,
                'inc rax'
            ]:[
                `mov rax, [${sourceLength}]`,
                `mov rdx, [${replacementLength}]`,
                'imul rax, rdx',
                `add rax, [${sourceLength}]`,
                `add rax, [${replacementLength}]`,
                'inc rax'
            ]),
            `mov [${outputCapacity}], rax`,
            'mov rcx, rax',
            'sub rsp, 40',
            'call [malloc]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${allocationFailure}`,
            `mov [${output}], rax`,
            `mov qword [${outputLength}], 0`,
            `mov qword [${searchStart}], 0`,
            `mov qword [${segmentStart}], 0`,
            `${mainLoop}:`,
            ...regexpMatcher,
            `${matched}:`,
            `mov rax, [${matchStart}]`,
            `sub rax, [${segmentStart}]`,
            `mov [${segmentLength}], rax`,
            ...ensureCapacity(segmentLength,segmentCapacityReady),
            `mov rcx, [${output}]`,
            `add rcx, [${outputLength}]`,
            `mov rdx, [${source}]`,
            `add rdx, [${segmentStart}]`,
            `mov r8, [${segmentLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            `mov rax, [${outputLength}]`,
            `add rax, [${segmentLength}]`,
            `mov [${outputLength}], rax`,
            ...invokeReplacement,
            `${afterReplacement}:`,
            `mov rax, [${matchEnd}]`,
            `mov [${segmentStart}], rax`,
            `mov [${searchStart}], rax`,
            ...(isGlobal?[`jmp ${mainLoop}`]:[`jmp ${copyTail}`]),
            `${noMatch}:`,
            `${copyTail}:`,
            `mov rax, [${sourceLength}]`,
            `sub rax, [${segmentStart}]`,
            `mov [${segmentLength}], rax`,
            ...ensureCapacity(segmentLength,tailCapacityReady),
            `mov rcx, [${output}]`,
            `add rcx, [${outputLength}]`,
            `mov rdx, [${source}]`,
            `add rdx, [${segmentStart}]`,
            `mov r8, [${segmentLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            `mov rax, [${output}]`,
            `add rax, [${outputLength}]`,
            `add rax, [${segmentLength}]`,
            'mov byte [rax], 0',
            `mov rax, [${output}]`,
            `jmp ${done}`,
            `${allocationFailure}:`,
            'mov ecx, 1',
            'sub rsp, 40',
            'call [ExitProcess]',
            'add rsp, 40',
            `jmp ${allocationFailure}`,
            `${done}:`,
            ...(compiledRegExp?[
                `mov rcx, [${transitionTable}]`,
                'sub rsp, 40',
                'call [free]',
                'add rsp, 40',
                `mov rax, [${output}]`
            ]:[]),
            'ret',
            'endp'
        ].join('\n')
        ASM.addProc(helper)

        let searchArgument = searchValue
        let replacementArgument = replacementValue
        if(compiledRegExp){
            const label = `__ds_string_replace_search_${id}`
            ASM.addData(`${label} db 0`)
            searchArgument = `addr ${label}`
        }else if(typeof search.value==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(search.value)){
            const label = `__ds_string_replace_search_${id}`
            ASM.addData(`${label} ${stringLiteralData(search.value)}`)
            searchArgument = `addr ${label}`
        }
        if(typeof replacement.value==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(replacement.value)){
            const label = `__ds_string_replace_replacement_${id}`
            ASM.addData(`${label} ${stringLiteralData(replacement.value)}`)
            replacementArgument = `addr ${label}`
        }
        const emitPointer = (register:string,value:string)=>{
            if(value.startsWith('addr ')){
                ASM.addCode(`lea ${register}, [${value.replace(/^addr\s+/,'')}]`)
            }else{
                ASM.addCode(`mov ${register}, ${value}`)
            }
        }
        emitPointer('rcx',stringValue)
        emitPointer('rdx',searchArgument)
        emitPointer('r8',replacementArgument)
        ASM.addCode('sub rsp, 40')
        ASM.addCode(`call ${helperName}`)
        ASM.addCode('add rsp, 40')
    }
