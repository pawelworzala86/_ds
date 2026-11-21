import Asm from '../../asm.ts'
import type {Call} from '../call.ts'

export function emitStringCharCodeAt(call:Call,ASM:Asm){
        const string = call.builtinStringCharCodeAt
        const index = call.params[0]
        if(!string||!index){
            throw new Error('String.charCodeAt is not initialized')
        }
        const stringValue = string.getCode(true)
        if(stringValue===null){
            throw new Error('Unable to resolve String.charCodeAt receiver')
        }
        if(stringValue.startsWith('addr ')){
            ASM.addCode(`lea rdx, [${stringValue.replace(/^addr\s+/,'')}]`)
        }else{
            ASM.addCode(`mov rdx, ${stringValue}`)
        }
        const indexValue = index.getCode(true)
        if(indexValue===null||indexValue.startsWith('addr ')){
            throw new Error('Unable to resolve String.charCodeAt index')
        }
        ASM.addCode(`mov rax, ${indexValue}`)
        ASM.addCode('add rdx, rax')
        ASM.addCode('movzx eax, byte [rdx]')
    }
