import Asm from '../../asm.ts'
import type {Call} from '../call.ts'

export function emitArrayBufferToString(call:Call,ASM:Asm){
    const buffer = call.builtinArrayBufferToString
    if(!buffer?.name){
        throw new Error('ArrayBuffer.toString receiver is missing')
    }
    ASM.addCode(buffer.isParameter
        ? `mov rax, ${buffer.name}`
        : `mov rax, [${buffer.name}]`)
}
