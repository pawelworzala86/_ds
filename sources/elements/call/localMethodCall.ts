import Asm from '../../asm.ts'
import Base from '../base.ts'
import DataElement from '../dataElement.ts'
import {stringData} from '../../stringLiteral.ts'
import {getClassArgumentCode} from './classArgument.ts'
import type ClassElement from '../clasElement.ts'
import type FuncElement from '../funcElement.ts'
import type {Call} from '../call.ts'

let methodStringId = 0
let dynamicMethodCallId = 0

type DynamicMethodTarget = {classType:ClassElement,func:FuncElement}

export function getDynamicMethodTargets(call:Call):DynamicMethodTarget[]{
    const instance = call.methodInstance
    const staticClass = instance?.classType?call.getClass(instance.classType):null
    const methodName = call.func?.sourceName
    if(!staticClass||staticClass.runtimeTypeId===null||!methodName||methodName==='constructor'){
        return []
    }
    let root:Base = call
    while(root.parent){
        root = root.parent
    }
    return root.CLASSES.flatMap(classType=>{
        if(classType===staticClass||classType.runtimeTypeId===null){
            return []
        }
        let parentClass = classType.parentClass
        let extendsStaticClass = false
        while(parentClass){
            if(parentClass===staticClass){
                extendsStaticClass = true
                break
            }
            parentClass = parentClass.parentClass
        }
        if(!extendsStaticClass){
            return []
        }
        const func = classType.getFunction(methodName)
        return func&&func!==call.func?[{classType,func}]:[]
    })
}

export function emitLocalMethodCall(call:Call,ASM:Asm){
        const instance = call.methodInstance
        if(!instance?.classType||!instance.name||!call.func?.name){
            throw new Error('Local method call target is not initialized')
        }
        const registers = ['rdx','r8','r9']
        const totalArguments = call.params.length+1
        const stackBytes = 32+Math.max(0,totalArguments-4)*8
        const stackSize = stackBytes+(stackBytes%16===0?8:0)
        ASM.addCode(`sub rsp, ${stackSize}`)
        if(instance.classPropertyInstance&&instance.classPropertyOffset!==null){
            const root = instance.classPropertyInstance
            if(root.isHeapAllocated||root.isReferenceAlias||root.isParameter){
                ASM.addCode(`mov rax, ${root.isParameter?root.name:`[${root.name}]`}`)
                ASM.addCode(`lea rcx, [rax+${instance.classPropertyOffset}]`)
            }else{
                ASM.addCode(`lea rcx, [${root.name}+${instance.classPropertyOffset}]`)
            }
        }else{
            ASM.addCode(instance.isParameter
                ? `mov rcx, ${instance.name}`
                : instance.isHeapAllocated
                    ? `mov rcx, [${instance.name}]`
                    : `lea rcx, [${instance.name}]`)
        }
        call.params.forEach((param,index)=>{
            const expected = call.func!.params[index]
            const value = param.value instanceof DataElement&&param.value.isArray
                ? param.getArrayArgumentCode(Boolean(expected?.dynamicArray))
                : getClassArgumentCode(param,expected?.type,call)??param.getCode(true)
            if(value===null){
                throw new Error(`Unable to resolve local method argument ${index+1}`)
            }
            const literal = value.match(/^(['"])([\s\S]*)\1$/)
            const argument = literal
                ? `addr __ds_method_string_${++methodStringId}`
                : value
            if(literal){
                ASM.addData(`__ds_method_string_${methodStringId} ${stringData(literal[2])}`)
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
        const dynamicTargets = getDynamicMethodTargets(call)
        if(dynamicTargets.length){
            const id = ++dynamicMethodCallId
            const done = `__ds_method_dispatch_done_${id}`
            ASM.addCode('mov r10, [rcx]')
            dynamicTargets.forEach((target,index)=>{
                const next = `__ds_method_dispatch_next_${id}_${index}`
                ASM.addCode(`cmp r10, ${target.classType.runtimeTypeId}`)
                ASM.addCode(`jne ${next}`)
                ASM.addCode(`call ${target.classType.name}.${target.func.name}`)
                ASM.addCode(`jmp ${done}`)
                ASM.addCode(`${next}:`)
            })
            ASM.addCode(`call ${instance.classType}.${call.func.name}`)
            ASM.addCode(`${done}:`)
        }else{
            ASM.addCode(`call ${instance.classType}.${call.func.name}`)
        }
        ASM.addCode(`add rsp, ${stackSize}`)
    }
