import Asm from '../../asm.ts'
import FuncElement from '../funcElement.ts'
import type {Call} from '../call.ts'

let promiseCallId = 0

export function emitPromiseMethod(call:Call,ASM:Asm){
    const promise = call.methodInstance
    const callback = call.params[0]?.value
    if(!promise?.name||!(callback instanceof FuncElement)||!callback.name){
        throw new Error('Promise callback call is not initialized')
    }
    const id = ++promiseCallId
    const skipped = `__ds_promise_callback_skipped_${id}`
    const wait = `__ds_promise_callback_wait_${id}`
    const settled = `__ds_promise_callback_settled_${id}`
    const status = call.builtinPromiseMethod==='then'?1:2
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
    ASM.addCode(`cmp qword [${promise.name}__state], ${status}`)
    ASM.addCode(`jne ${skipped}`)
    ASM.addCode(`push qword [${promise.name}__value]`)
    ASM.addCode('sub rsp, 32')
    ASM.addCode(`call ${callback.name}`)
    ASM.addCode('add rsp, 40')
    ASM.addCode(`${skipped}:`)
}
