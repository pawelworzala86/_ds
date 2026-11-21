import Asm from '../../asm.ts'
import DataElement from '../dataElement.ts'
import {stringData} from '../../stringLiteral.ts'
import type {Call} from '../call.ts'

let superStringId = 0

export function emitSuperCall(call:Call,ASM:Asm){
        if(!call.func?.name){
            throw new Error('Parent method is not initialized')
        }
        if(call.params.length!==call.func.params.length){
            throw new Error(`Parent method "${call.func.name}" expects ${call.func.params.length} arguments, received ${call.params.length}`)
        }
        const registers = ['rdx','r8','r9']
        const totalArguments = call.params.length+1
        const stackBytes = 32+Math.max(0,totalArguments-4)*8
        const stackSize = stackBytes+(stackBytes%16===0?8:0)
        ASM.addCode(`sub rsp, ${stackSize}`)
        ASM.addCode('mov rcx, rsi')
        call.params.forEach((param,index)=>{
            const expected = call.func!.params[index]
            const value = expected?.dynamicArray&&param.value instanceof DataElement&&param.value.isArray
                ? param.value.isParameter?param.value.name:`addr ${param.value.name}`
                : param.getCode(true)
            if(value===null){
                throw new Error(`Unable to resolve parent method argument ${index+1}`)
            }
            const literal = value.match(/^(['"])([\s\S]*)\1$/)
            const argument = literal
                ? `addr __ds_super_string_${++superStringId}`
                : value
            if(literal){
                ASM.addData(`__ds_super_string_${superStringId} ${stringData(literal[2])}`)
            }
            const register = registers[index]
            if(register){
                const address = argument.match(/^addr\s+(.+)$/i)
                ASM.addCode(address
                    ? `lea ${register}, [${address[1]}]`
                    : `mov ${register}, ${argument}`)
            }else{
                const offset = 32+(index-registers.length)*8
                const address = argument.match(/^addr\s+(.+)$/i)
                if(address){
                    ASM.addCode(`lea rax, [${address[1]}]`)
                }else{
                    ASM.addCode(`mov rax, ${argument}`)
                }
                ASM.addCode(`mov qword [rsp+${offset}], rax`)
            }
        })
        ASM.addCode(`call ${call.methodInstance?.classType}.${call.func.name}`)
        ASM.addCode(`add rsp, ${stackSize}`)
    }
