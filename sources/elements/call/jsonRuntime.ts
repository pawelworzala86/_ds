import Asm from '../../asm.ts'
import DataElement from '../dataElement.ts'
import type {Call} from '../call.ts'
import {stringLiteralData} from '../../stringLiteral.ts'
import {ensureJSONRuntime} from '../data/jsonRuntime.ts'

let literalId = 0

function emitArgumentValue(call:Call,ASM:Asm,index:number,register:string){
    const argument = call.params[index]
    if(!argument){
        throw new Error(`Missing JSON.${call.jsonRuntimeMethod} argument`)
    }
    if(typeof argument.value==='string'&&/^(['"])[\s\S]*\1$/.test(argument.value)){
        const label = `__ds_json_argument_${++literalId}`
        ASM.addData(`${label} ${stringLiteralData(argument.value)}`)
        ASM.addCode(`lea ${register}, [${label}]`)
        return
    }
    if(argument.tempName){
        ASM.addCode(`mov ${register}, [${argument.tempName}]`)
        return
    }
    if(argument.value instanceof DataElement){
        if(argument.classPropertyInstance&&argument.classProperty){
            const access = argument.getCode(true)
            if(!access){
                throw new Error(`Unable to resolve JSON.${call.jsonRuntimeMethod} argument`)
            }
            ASM.addCode(`mov ${register}, ${access}`)
            return
        }
        ASM.addCode(argument.value.isParameter
            ? `mov ${register}, ${argument.value.name}`
            : `mov ${register}, [${argument.value.name}]`)
        return
    }
    const value = argument.getCode(true)
    if(!value){
        throw new Error(`Unable to resolve JSON.${call.jsonRuntimeMethod} argument`)
    }
    ASM.addCode(`mov ${register}, ${value}`)
}

export function emitJSONRuntimeCall(call:Call,ASM:Asm){
    const method = call.jsonRuntimeMethod
    if(!method){
        throw new Error('JSON runtime call has no method')
    }
    ensureJSONRuntime(ASM)
    if(method==='free'){
        emitArgumentValue(call,ASM,0,'rcx')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call __ds_json_free')
        ASM.addCode('add rsp, 40')
        ASM.addCode('xor rax, rax')
        return
    }
    if(method==='isValid'){
        emitArgumentValue(call,ASM,0,'rcx')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call __ds_json_is_valid')
        ASM.addCode('add rsp, 40')
        return
    }
    emitArgumentValue(call,ASM,0,'rcx')
    const target = method==='parse'
        ?'__ds_json_parse'
        :method==='fromString'
            ?'__ds_json_from_string'
            :method==='stringify'
                ?'__ds_json_stringify'
                :null
    if(!target){
        throw new Error(`Unsupported JSON runtime method "${method}"`)
    }
    ASM.addCode('sub rsp, 40')
    ASM.addCode(`call ${target}`)
    ASM.addCode('add rsp, 40')
}
