import Asm from '../../asm.ts'
import DataElement from '../dataElement.ts'
import {stringLiteralData} from '../../stringLiteral.ts'
import type Base from '../base.ts'
import type {Call} from '../call.ts'
import {getClassArgumentCode} from './classArgument.ts'
import {getDynamicMethodTargets} from './localMethodCall.ts'

let functionCallStringId = 0

function hasSameStructLayout(properties:DataElement[],classType:ReturnType<Base['getClass']>|null){
    return Boolean(classType
        &&properties.length===classType.props.length
        &&properties.every((property,index)=>{
            const expected = classType.props[index]
            return property.name===expected.name
                &&property.type===expected.type
                &&property.isArray===expected.isArray
                &&property.classType===expected.classType
        }))
}

export function emitCall(call:Call,ASM:Asm,asyncMode:'detached'|'handle'|'await'='detached'){
        if(call.noOp){
            return
        }
        for(const initializer of call.defaultInitializers){
            initializer.declaration.asm(ASM)
            initializer.call?.asm(ASM)
        }
        if(call.arrayMethodArray&&call.arrayMethodIndex&&call.methodInstance?.name){
            const array = call.arrayMethodArray
            call.arrayMethodIndex.asm(ASM)
            const index = call.arrayMethodIndex.getCode(true)
            if(index===null){
                throw new Error('Unable to resolve array method index')
            }
            ASM.addData(`${call.methodInstance.name} dq 0`)
            ASM.addCode(`mov rax, ${index}`)
            ASM.addCode('shl rax, 3')
            if(array.classPropertyInstance&&array.classPropertyOffset!==null){
                const root = array.classPropertyInstance
                if(root.isHeapAllocated||root.isReferenceAlias){
                    ASM.addCode(`mov rdx, [${root.name}]`)
                }else if(root.isParameter){
                    ASM.addCode(`mov rdx, ${root.name}`)
                }else{
                    ASM.addCode(`lea rdx, [${root.name}]`)
                }
                if(array.classPropertyOffset){
                    ASM.addCode(`add rdx, ${array.classPropertyOffset}`)
                }
                if(array.dynamicArray){
                    ASM.addCode('mov rdx, [rdx]')
                }
            }else if(array.isParameter){
                ASM.addCode(`mov rdx, ${array.name}`)
                if(array.dynamicArray){
                    ASM.addCode('mov rdx, [rdx]')
                }
            }else{
                ASM.addCode(array.dynamicArray
                    ? `mov rdx, [${array.name}]`
                    : `lea rdx, [${array.name}]`)
            }
            ASM.addCode('add rdx, rax')
            ASM.addCode('mov rax, [rdx]')
            ASM.addCode(`mov [${call.methodInstance.name}], rax`)
        }
        for(const param of call.params){
            const nestedCall = call.nestedArgumentCalls.get(param)
            if(nestedCall){
                nestedCall.asm(ASM)
                ASM.addData(`${param.tempName} dq 0`)
                ASM.addCode(`mov [${param.tempName}], rax`)
            }else{
                param.asm(ASM)
            }
        }
        if(call.builtinConsoleLog){
            call.emitConsoleLog(ASM)
            return
        }
        if(call.superCall){
            call.emitSuperCall(ASM)
            return
        }
        if(call.func?.isAsync){
            call.emitAsyncCall(ASM,asyncMode)
            return
        }
        if(asyncMode!=='detached'){
            throw new Error('Only async functions can produce or await a Task')
        }
        if(call.builtinArray){
            call.emitArrayPush(ASM)
            return
        }
        if(call.builtinArrayForEach){
            call.emitArrayForEach(ASM)
            return
        }
        if(call.builtinArrayToString){
            call.emitArrayToString(ASM)
            return
        }
        if(call.builtinArrayBufferToString){
            call.emitArrayBufferToString(ASM)
            return
        }
        if(call.builtinStringCharCodeAt){
            call.emitStringCharCodeAt(ASM)
            return
        }
        if(call.builtinStringSplit){
            call.emitStringSplit(ASM)
            return
        }
        if(call.builtinStringReplace){
            call.emitStringReplace(ASM)
            return
        }
        if(call.builtinStringSearch){
            call.emitStringSearch(ASM)
            return
        }
        if(call.builtinStringRange){
            call.emitStringRange(ASM)
            return
        }
        if(call.builtinStringConcat){
            call.emitStringConcat(ASM)
            return
        }
        if(call.builtinStringTransform){
            call.emitStringTransform(ASM)
            return
        }
        if(call.builtinPromiseMethod){
            call.emitPromiseMethod(ASM)
            return
        }
        if(call.functionVariable){
            const params = call.params.map(param=>{
                const value = param.getCode()
                if(value===null){
                    throw new Error('Unable to resolve function pointer argument')
                }
                if(value.startsWith('&')){
                    throw new Error(`Unable to resolve address argument "${value}"`)
                }
                if(value.startsWith("'")&&value.endsWith("'")){
                    return `addr ${value}`
                }
                if(param.value instanceof DataElement&&param.value.isConstAlias){
                    return value
                }
                if(param.value instanceof DataElement&&param.value.type==='Function'){
                    return `[${param.value.name}]`
                }else if(param.value instanceof DataElement&&param.value.type==='string'&&!param.value.isArray){
                    return param.value.isParameter?`[${value}]`:value
                }else if(param.arrayPointerName){
                    return `[${param.arrayPointerName}]`
                }else if(param.value instanceof DataElement&&param.value.isArray){
                    if(param.value.dynamicArray){
                        return `[${param.value.name}]`
                    }
                    return `addr ${param.value.name}`
                }
                if(param.tempName){
                    return `[${param.tempName}]`
                }
                if(value.startsWith('addr ')){
                    return value
                }
                return value.startsWith('[')&&value.endsWith(']')?value:`[${value}]`
            })
            const floatingParams = call.params.map(param=>
                param.expression?.numericKind==='float'
                ||param.value instanceof DataElement
                    &&!param.value.isArray
                    &&param.value.numericKind==='float'
            )
            const integerRegisters = ['rcx','rdx','r8','r9']
            const stackBytes = 32+Math.max(0,params.length-integerRegisters.length)*8
            const stackSize = stackBytes+(stackBytes%16===0?8:0)
            ASM.addCode(`sub rsp, ${stackSize}`)
            params.forEach((value,index)=>{
                const address = value.match(/^addr\s+(.+)$/i)
                if(index<integerRegisters.length){
                    if(floatingParams[index]){
                        ASM.addCode(`movsd xmm${index}, qword ${value}`)
                    }else if(address){
                        let target = address[1].trim()
                        if(/^(['"]).*\1$/.test(target)){
                            const label = `__ds_function_call_string_${++functionCallStringId}`
                            ASM.addData(`${label} ${stringLiteralData(target)}`)
                            target = label
                        }
                        const operand = target.startsWith('[')&&target.endsWith(']')
                            ? target
                            : `[${target}]`
                        ASM.addCode(`lea ${integerRegisters[index]}, ${operand}`)
                    }else{
                        ASM.addCode(`mov ${integerRegisters[index]}, ${value}`)
                    }
                }else{
                    const offset = 32+(index-integerRegisters.length)*8
                    if(address){
                        let target = address[1].trim()
                        if(/^(['"]).*\1$/.test(target)){
                            const label = `__ds_function_call_string_${++functionCallStringId}`
                            ASM.addData(`${label} ${stringLiteralData(target)}`)
                            target = label
                        }
                        const operand = target.startsWith('[')&&target.endsWith(']')
                            ? target
                            : `[${target}]`
                        ASM.addCode(`lea rax, ${operand}`)
                    }else{
                        ASM.addCode(`mov rax, ${floatingParams[index]?`qword ${value}`:value}`)
                    }
                    ASM.addCode(`mov qword [rsp+${offset}], rax`)
                }
            })
            ASM.addCode(`call [${call.functionVariable.name}]`)
            ASM.addCode(`add rsp, ${stackSize}`)
            return
        }
        if(!call.func){
            throw new Error(`Unable to resolve function call "${call.callName??'unknown'}"`)
        }
        if(call.methodInstance?.classPropertyInstance
            ||call.methodInstance?.isProcedureLocal
            ||call.methodInstance?.isReferenceAlias
            ||call.methodInstance?.isParameter
            ||Boolean(call.methodInstance&&getDynamicMethodTargets(call).length)){
            call.emitLocalMethodCall(ASM)
            return
        }
        const canEmitArguments = call.params.every(param=>
            param.value instanceof DataElement
            ||param.tempName!==null
            ||param.arrayPointerName!==null
            ||typeof param.value==='string'&&/^(['"])[\s\S]*\1$/.test(param.value)
        )
        if(canEmitArguments&&!call.methodInstance){
            for(let index=0;index<call.params.length;index++){
                const param = call.params[index]
                const expected = call.func?.params[index]
                const expectedClass = expected?.type?call.getClass(expected.type):null
                const classArgument = getClassArgumentCode(param,expected?.type,call)
                if(expected?.dynamicArray&&param.value instanceof DataElement&&param.value.isArray){
                    ASM.addCode(param.value.isParameter
                        ? `mov rax, ${param.value.name}`
                        : `lea rax, [${param.value.name}]`)
                }else if(typeof param.value==='string'&&/^(['"])[\s\S]*\1$/.test(param.value)){
                    const label = `__ds_function_call_string_${++functionCallStringId}`
                    ASM.addData(`${label} ${stringLiteralData(param.value)}`)
                    ASM.addCode(`lea rax, [${label}]`)
                }else if(param.value instanceof DataElement&&param.value.isConstAlias){
                    ASM.addCode(`mov rax, ${param.value.name}`)
                }else if(param.value instanceof DataElement&&param.value.isArray&&!param.arrayPointerName){
                    if(param.value.dynamicArray){
                        ASM.addCode(`mov rax, [${param.value.name}]`)
                    }else{
                        ASM.addCode(`lea rax, [${param.value.name}]`)
                    }
                }else if(param.arrayPointerName){
                    ASM.addCode(`mov rax, [${param.arrayPointerName}]`)
                }else if(param.tempName){
                    ASM.addCode(`mov rax, [${param.tempName}]`)
                }else if(param.classPropertyInstance&&param.classProperty?.type==='string'){
                    const name = param.getClassPropertyAccessName()
                    ASM.addCode(`mov rax, [${name}]`)
                }else if(param.value instanceof DataElement&&param.value.type==='string'&&!param.value.isArray){
                    const value = param.value
                    if(value.isReferenceAlias){
                        ASM.addCode(`mov rdx, [${value.name}]`)
                        ASM.addCode('mov rax, [rdx]')
                    }else{
                        ASM.addCode(value.isParameter
                            ? `mov rax, ${value.name}`
                            : `mov rax, [${value.getAccessName()}]`)
                    }
                }else if(classArgument){
                    const address = classArgument.match(/^addr\s+(.+)$/i)
                    ASM.addCode(address
                        ? `lea rax, [${address[1]}]`
                        : `mov rax, ${classArgument}`)
                }else if(param.value instanceof DataElement&&param.value.classType
                    &&(expected?.type===param.value.classType||param.value.classLayoutProps&&hasSameStructLayout(param.value.classLayoutProps,expectedClass))){
                    ASM.addCode((param.value.isProcedureLocal||param.value.isReferenceAlias)
                        &&param.value.isHeapAllocated
                        ? `mov rax, [${param.value.name}]`
                        : `lea rax, [${param.value.name}]`)
                }else{
                    const value = param.getCode()
                    if(value===null){
                        throw new Error('Unable to resolve function argument')
                    }
                    ASM.addCode(value.startsWith('addr ')
                        ? `lea rax, [${value.replace(/^addr\s+/,'')}]`
                        : `mov rax, [${value}]`)
                }
                ASM.addCode('push rax')
            }
            const shadowSpace = 32+(call.params.length%2===0?8:0)
            ASM.addCode(`sub rsp, ${shadowSpace}`)
            ASM.addCode(`call ${call.func!.name}`)
            ASM.addCode(`add rsp, ${shadowSpace+call.params.length*8}`)
            return
        }
        const params = call.params.map((param,index)=>{
            if(param.value instanceof DataElement&&param.value.isArray){
                return param.getArrayArgumentCode(Boolean(call.func?.params[index]?.dynamicArray))
            }
            return getClassArgumentCode(param,call.func?.params[index]?.type,call)
                ??param.getCode(call.methodInstance!==null)
        }).join(', ')
        const methodName = call.methodInstance?.isProcedureLocal
            ? `${call.methodInstance.classType}.${call.func!.name}`
            : `${call.methodInstance?.name}.${call.func!.name}`
        const methodParams = call.methodInstance?.isProcedureLocal
            ? `addr ${call.methodInstance.name}${params?`, ${params}`:''}`
            : params
        const code = call.methodInstance
            ? `invoke ${methodName} ${methodParams}`
            : `rvcall ${call.func!.name} ${params}`
        ASM.addCode(code)
    }
