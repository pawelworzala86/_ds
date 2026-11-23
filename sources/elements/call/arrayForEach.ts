import Asm from '../../asm.ts'
import FuncElement from '../funcElement.ts'
import type {Call} from '../call.ts'

let arrayForEachId = 0

export function emitArrayForEach(call:Call,ASM:Asm){
    const array = call.builtinArrayForEach
    const callback = call.params[0]?.value
    if(!array?.name||!(callback instanceof FuncElement)||!callback.name){
        throw new Error('Array.forEach callback is not initialized')
    }
    const id = ++arrayForEachId
    const index = `__ds_array_foreach_index_${id}`
    const loop = `__ds_array_foreach_loop_${id}`
    const done = `__ds_array_foreach_done_${id}`
    ASM.addData(`${index} dq 0`)
    ASM.addCode(`mov qword [${index}], 0`)
    ASM.addCode(`${loop}:`)
    ASM.addCode(`mov rax, [${index}]`)
    if(array.dynamicArray){
        if(array.isParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('cmp rax, [rdx+8]')
        }else{
            ASM.addCode(`cmp rax, [${array.name}__length]`)
        }
    }else{
        if(array.arrayLength===null){
            throw new Error('Array.forEach requires a known array length')
        }
        ASM.addCode(`cmp rax, ${array.arrayLength}`)
    }
    ASM.addCode(`jnb ${done}`)
    ASM.addCode('shl rax, 3')
    if(array.dynamicArray){
        ASM.addCode(array.isParameter
            ? `mov rdx, ${array.name}`
            : `mov rdx, [${array.name}]`)
        if(array.isParameter){
            ASM.addCode('mov rdx, [rdx]')
        }
    }else if(array.isParameter){
        ASM.addCode(`mov rdx, ${array.name}`)
    }else{
        ASM.addCode(`lea rdx, [${array.name}]`)
    }
    ASM.addCode('add rdx, rax')
    ASM.addCode('mov rax, [rdx]')
    ASM.addCode('push rax')
    ASM.addCode('sub rsp, 32')
    ASM.addCode(`call ${callback.name}`)
    ASM.addCode('add rsp, 40')
    ASM.addCode(`inc qword [${index}]`)
    ASM.addCode(`jmp ${loop}`)
    ASM.addCode(`${done}:`)
}
