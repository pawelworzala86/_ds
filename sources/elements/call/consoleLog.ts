import Asm from '../../asm.ts'
import DataElement, {getNumericKind} from '../dataElement.ts'
import {stringData,stringLiteralData} from '../../stringLiteral.ts'
import type {Call} from '../call.ts'

let consoleLogId = 0

export function emitConsoleLog(call:Call,ASM:Asm){
        ASM.addImport('msvcrt','printf')
        const emitPrintf = (format:string,value?:string,float=false)=>{
            const formatLabel = `__ds_console_log_format_${++consoleLogId}`
            ASM.addData(`${formatLabel} ${stringData(format)}`)
            if(float){
                if(!value){
                    throw new Error('Unable to resolve floating-point console.log argument')
                }
                ASM.addCode('sub rsp, 40')
                ASM.addCode(`lea rcx, [${formatLabel}]`)
                ASM.addCode(`movsd xmm1, qword ${value}`)
                ASM.addCode('movsd qword [rsp+32], xmm1')
                ASM.addCode('mov rdx, qword [rsp+32]')
                ASM.addCode('call [printf]')
                ASM.addCode('add rsp, 40')
            }else{
                ASM.addCode(`invoke printf addr ${formatLabel}${value?`, ${value}`:''}`)
            }
        }

        if(!call.params.length){
            emitPrintf('\n')
            return
        }
        call.params.forEach((param,index)=>{
            const prefix = index===0?'':' '
            const arrayElementDone = param.arrayElementAccess&&param.tempName
                ? `__ds_console_log_array_done_${++consoleLogId}`
                : null
            if(arrayElementDone&&param.tempName){
                const defined = `${arrayElementDone}_defined`
                const undefinedValue = `${param.tempName}_undefined_value`
                ASM.addCode(`mov rax, [${param.tempName}]`)
                ASM.addCode(`cmp rax, [${undefinedValue}]`)
                ASM.addCode(`jne ${defined}`)
                emitPrintf(`${prefix}undefined`)
                ASM.addCode(`jmp ${arrayElementDone}`)
                ASM.addCode(`${defined}:`)
            }
            try{
            const value = param.value
            if(typeof value==='string'&&/^(['"])[\s\S]*\1$/.test(value)){
                const label = `__ds_console_log_string_${++consoleLogId}`
                ASM.addData(`${label} ${stringLiteralData(value)}`)
                emitPrintf(`${prefix}%s`,`addr ${label}`)
                return
            }
            if(typeof value==='string'&&['true','false','null','undefined'].includes(value)){
                const label = `__ds_console_log_string_${++consoleLogId}`
                ASM.addData(`${label} ${stringData(value)}`)
                emitPrintf(`${prefix}%s`,`addr ${label}`)
                return
            }

            const data = value instanceof DataElement?value:null
            const type = param.classProperty?.type??data?.type
            if(type==='boolean'&&data&&!data.isArray){
                const id = ++consoleLogId
                const trueLabel = `__ds_console_log_true_${id}`
                const falseLabel = `__ds_console_log_false_${id}`
                const trueBranch = `__ds_console_log_boolean_true_${id}`
                const done = `__ds_console_log_boolean_done_${id}`
                ASM.addData(`${trueLabel} ${stringData('true')}`)
                ASM.addData(`${falseLabel} ${stringData('false')}`)
                const argument = data.isParameter?data.name:param.getCode(true)
                if(!argument){
                    throw new Error('Unable to resolve boolean console.log argument')
                }
                ASM.addCode(`mov rax, ${argument}`)
                ASM.addCode('test rax, rax')
                ASM.addCode(`jnz ${trueBranch}`)
                ASM.addCode(`lea rdx, [${falseLabel}]`)
                ASM.addCode(`jmp ${done}`)
                ASM.addCode(`${trueBranch}:`)
                ASM.addCode(`lea rdx, [${trueLabel}]`)
                ASM.addCode(`${done}:`)
                emitPrintf(`${prefix}%s`,'rdx')
                return
            }
            const jsonValue = param.jsonValue!==undefined
                ? param.jsonValue
                : param.classProperty?.jsonValue!==undefined
                    ? param.classProperty.jsonValue
                    : data?.jsonValue
            const isUntypedJSONArrayItem = param.jsonValue!==undefined
                &&(param.classProperty?.type==='any'||data?.type==='any')
            if(isUntypedJSONArrayItem&&typeof jsonValue==='string'){
                const label = `__ds_console_log_string_${++consoleLogId}`
                ASM.addData(`${label} ${stringData(JSON.stringify(jsonValue).slice(1,-1))}`)
                emitPrintf(`${prefix}%s`,`addr ${label}`)
                return
            }
            if(isUntypedJSONArrayItem&&typeof jsonValue==='number'){
                if(Number.isInteger(jsonValue)){
                    emitPrintf(`${prefix}%lld`,String(jsonValue))
                }else{
                    const label = `__ds_console_log_number_${++consoleLogId}`
                    ASM.addData(`${label} dq ${jsonValue}`)
                    emitPrintf(`${prefix}%f`,`[${label}]`,true)
                }
                return
            }
            if(jsonValue===null||typeof jsonValue==='boolean'){
                const label = `__ds_console_log_string_${++consoleLogId}`
                ASM.addData(`${label} ${stringData(String(jsonValue))}`)
                emitPrintf(`${prefix}%s`,`addr ${label}`)
                return
            }
            if(type==='bigint'){
                const typedArrayKind = data?.typedArrayKind
                if(!typedArrayKind||!typedArrayKind.startsWith('Big')){
                    throw new Error('Unable to resolve bigint console.log argument')
                }
                const argument = param.getCode(true)
                if(!argument){
                    throw new Error('Unable to resolve bigint console.log argument')
                }
                emitPrintf(
                    `${prefix}${typedArrayKind==='BigUint64Array'?'%llu':'%lld'}n`,
                    argument
                )
                return
            }
            if(type==='string'){
                const argument = param.getCode(true)
                if(!argument){
                    throw new Error('Unable to resolve string console.log argument')
                }
                emitPrintf(`${prefix}%s`,argument)
                return
            }
            const inferredNumeric = data?.type===''
                &&/^[+-]?(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(data.value??'')
            if(type==='number'||inferredNumeric||param.expression){
                const argument = inferredNumeric&&data
                    ? `[${data.name}]`
                    : param.getCode(true)
                if(!argument){
                    throw new Error('Unable to resolve numeric console.log argument')
                }
                const numericKind = param.expression?.numericKind
                    ??(inferredNumeric?getNumericKind(data?.value??''):data?.numericKind)
                    ??'integer'
                emitPrintf(`${prefix}${numericKind==='float'?'%f':'%lld'}`,argument,numericKind==='float')
                return
            }

            let argument = param.getCode(true)
            if(data){
                if(data.isArray){
                    argument = data.isParameter
                        ? data.name
                        : data.dynamicArray
                            ? `[${data.name}]`
                            : `addr ${data.name}`
                }else if(data.isParameter){
                    argument = data.name
                }else if(data.classType||data.classLayoutProps){
                    argument = data.isProcedureLocal&&data.isHeapAllocated
                        ? `[${data.name}]`
                        : `addr ${data.name}`
                }
            }
            if(!argument){
                throw new Error('Unable to resolve console.log argument')
            }
            emitPrintf(`${prefix}%p`,argument)
            }finally{
                if(arrayElementDone){
                    ASM.addCode(`${arrayElementDone}:`)
                }
            }
        })
        emitPrintf('\n')
    }
