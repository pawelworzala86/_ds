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
        })
        emitPrintf('\n')
    }
