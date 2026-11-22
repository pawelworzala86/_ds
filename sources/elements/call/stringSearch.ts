import Asm from '../../asm.ts'
import {stringLiteralData} from '../../stringLiteral.ts'
import type {Call} from '../call.ts'

let stringSearchId = 0

export function emitStringSearch(call:Call,ASM:Asm){
        const string = call.builtinStringSearch
        const search = call.params[0]
        const method = call.builtinStringSearchMethod
        if(!string||!search||!method){
            throw new Error('String search method is not initialized')
        }
        const stringValue = string.getCode(true)
        const searchValue = search.getCode(true)
        if(stringValue===null||searchValue===null){
            throw new Error('Unable to resolve String search arguments')
        }

        const id = ++stringSearchId
        const source = `__ds_string_search_${id}_source`
        const needle = `__ds_string_search_${id}_needle`
        const sourceLength = `__ds_string_search_${id}_source_length`
        const needleLength = `__ds_string_search_${id}_needle_length`
        const done = `__ds_string_search_${id}_done`
        const found = `__ds_string_search_${id}_found`
        const notFound = `__ds_string_search_${id}_not_found`
        const sourceLiteral = `__ds_string_search_${id}_source_literal`
        const needleLiteral = `__ds_string_search_${id}_needle_literal`
        let sourceArgument = stringValue
        let needleArgument = searchValue

        if(typeof sourceArgument==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(sourceArgument)){
            ASM.addData(`${sourceLiteral} ${stringLiteralData(sourceArgument)}`)
            sourceArgument = `addr ${sourceLiteral}`
        }
        if(typeof needleArgument==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(needleArgument)){
            ASM.addData(`${needleLiteral} ${stringLiteralData(needleArgument)}`)
            needleArgument = `addr ${needleLiteral}`
        }

        const emitPointer = (register:string,value:string)=>{
            if(value.startsWith('addr ')){
                ASM.addCode(`lea ${register}, [${value.replace(/^addr\s+/,'')}]`)
            }else{
                ASM.addCode(`mov ${register}, ${value}`)
            }
        }
        emitPointer('rcx',sourceArgument)
        ASM.addData(`${source} dq 0`)
        ASM.addCode(`mov [${source}], rcx`)
        emitPointer('rcx',needleArgument)
        ASM.addData(`${needle} dq 0`)
        ASM.addCode(`mov [${needle}], rcx`)

        if(method==='indexOf'||method==='includes'){
            ASM.addImport('msvcrt','strstr')
            ASM.addCode(`mov rcx, [${source}]`)
            ASM.addCode(`mov rdx, [${needle}]`)
            ASM.addCode('sub rsp, 40')
            ASM.addCode('call [strstr]')
            ASM.addCode('add rsp, 40')
            if(method==='indexOf'){
                ASM.addCode('test rax, rax')
                ASM.addCode(`jz ${notFound}`)
                ASM.addCode(`sub rax, [${source}]`)
                ASM.addCode(`jmp ${done}`)
                ASM.addCode(`${notFound}:`)
                ASM.addCode('mov rax, -1')
                ASM.addCode(`${done}:`)
            }else{
                ASM.addCode('test rax, rax')
                ASM.addCode(`jz ${notFound}`)
                ASM.addCode('mov eax, 1')
                ASM.addCode(`jmp ${done}`)
                ASM.addCode(`${notFound}:`)
                ASM.addCode('xor eax, eax')
                ASM.addCode(`${done}:`)
            }
            return
        }

        ASM.addImport('msvcrt','strlen')
        ASM.addImport('msvcrt','strncmp')
        ASM.addData(`${sourceLength} dq 0`)
        ASM.addData(`${needleLength} dq 0`)
        ASM.addCode(`mov rcx, [${needle}]`)
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [strlen]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`mov [${needleLength}], rax`)
        ASM.addCode(`mov rcx, [${source}]`)
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [strlen]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`mov [${sourceLength}], rax`)
        ASM.addCode(`cmp qword [${needleLength}], 0`)
        ASM.addCode(`je ${found}`)
        ASM.addCode(`mov rax, [${needleLength}]`)
        ASM.addCode(`cmp rax, [${sourceLength}]`)
        ASM.addCode(`ja ${notFound}`)
        if(method==='startsWith'){
            ASM.addCode(`mov rcx, [${source}]`)
        }else{
            ASM.addCode(`mov rcx, [${source}]`)
            ASM.addCode(`add rcx, [${sourceLength}]`)
            ASM.addCode(`sub rcx, [${needleLength}]`)
        }
        ASM.addCode(`mov rdx, [${needle}]`)
        ASM.addCode(`mov r8, [${needleLength}]`)
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [strncmp]')
        ASM.addCode('add rsp, 40')
        ASM.addCode('test eax, eax')
        ASM.addCode(`jz ${found}`)
        ASM.addCode(`${notFound}:`)
        ASM.addCode('xor eax, eax')
        ASM.addCode(`jmp ${done}`)
        ASM.addCode(`${found}:`)
        ASM.addCode('mov eax, 1')
        ASM.addCode(`${done}:`)
    }
