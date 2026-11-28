import Base from '../base.ts'
import DataElement from '../dataElement.ts'
import {getClassPropertyAccess,getClassPropertyOffset} from '../clasElement.ts'
import Asm from '../../asm.ts'
import {stringData,decodeStringEscapes,getStringLiteralContents} from '../../stringLiteral.ts'
import {ensureJSONRuntime} from './jsonRuntime.ts'
import type {Expression} from '../../maths/types.ts'

export type DynamicJSONStep =
    | {kind:'property',key:string}
    | {kind:'key',expression:string,source:DataElement}
    | {kind:'index',expression:string,parsed:Expression|null}

export type DynamicJSONAccess = {
    root:DataElement
    steps:DynamicJSONStep[]
}

let accessId = 0

function isDynamicRoot(data:DataElement|null|undefined){
    return Boolean(data&&!data.isArray&&data.isDynamicJSON)
}

function makeClassPropertyRoot(active:Base,expression:string){
    const access = getClassPropertyAccess(active,expression)
    if(!access||!isDynamicRoot(access.property)){
        return null
    }
    const value = new DataElement(
        'let',
        `${access.instance.name}.${access.path}`,
        access.property.type??'any',
        access.property.value??'0'
    )
    value.isDynamicJSON = true
    value.classPropertyInstance = access.instance
    value.classPropertyPath = access.path
    value.classType = access.property.classType
    value.isArray = access.property.isArray
    const rootClass = access.instance.classType
        ? active.getClass(access.instance.classType)
        : null
    value.classPropertyOffset = rootClass
        ? getClassPropertyOffset(
            rootClass,
            expression.split('.').slice(1).join('.'),
            name=>active.getClass(name)
        )
        : null
    if(access.instance.classType&&value.classPropertyOffset===null){
        throw new Error(`Unable to resolve dynamic JSON property "${expression}"`)
    }
    return value
}

function makeStringPropertySource(active:Base,expression:string){
    const access = getClassPropertyAccess(active,expression)
    if(!access||access.property.type!=='string'||access.property.isArray){
        return null
    }
    const classType = access.instance.classType
        ? active.getClass(access.instance.classType)
        : null
    const offset = classType
        ? getClassPropertyOffset(
            classType,
            expression.split('.').slice(1).join('.'),
            name=>active.getClass(name)
        )
        : null
    if(offset===null){
        throw new Error(`Unable to resolve dynamic JSON key "${expression}"`)
    }
    const value = new DataElement(
        'let',
        `${access.instance.name}.${access.path}`,
        'string',
        access.property.value??'0'
    )
    value.classPropertyInstance = access.instance
    value.classPropertyPath = access.path
    value.classPropertyOffset = offset
    return value
}

function parseParts(text:string){
    const rootMatch = text.match(/^[a-z_$][\w$]*/i)
    if(!rootMatch){
        return null
    }
    const root = rootMatch[0]
    const parts:{kind:'property'|'bracket',value:string,end:number}[] = []
    let position = root.length
    while(position<text.length){
        if(text[position]==='.'){
            const property = text.slice(position+1).match(/^[a-z_$][\w$]*/i)
            if(!property){
                return null
            }
            position += property[0].length+1
            parts.push({kind:'property',value:property[0],end:position})
            continue
        }
        if(text[position]==='['){
            let end = position+1
            let quote = ''
            let escaped = false
            for(;end<text.length;end++){
                const char = text[end]
                if(quote){
                    if(escaped){
                        escaped = false
                    }else if(char==='\\'){
                        escaped = true
                    }else if(char===quote){
                        quote = ''
                    }
                }else if(char==="'"||char==='"'){
                    quote = char
                }else if(char===']'){
                    break
                }
            }
            if(end===text.length||quote){
                return null
            }
            parts.push({kind:'bracket',value:text.slice(position+1,end).trim(),end:end+1})
            position = end+1
            continue
        }
        return null
    }
    return {root,parts}
}

export function getDynamicJSONAccess(
    expression:string,
    active:Base,
    parseIndex?:(expression:string)=>Expression
):DynamicJSONAccess|null{
    const text = expression.trim()
    const parsed = parseParts(text)
    if(!parsed){
        return null
    }
    let root:DataElement|null = null
    let rootPartCount = 0
    let prefix = parsed.root
    const direct = active.getData(prefix)
    if(isDynamicRoot(direct)){
        root = direct
    }
    for(let index=0;index<parsed.parts.length;index++){
        const part = parsed.parts[index]
        if(part.kind!=='property'){
            break
        }
        prefix += `.${part.value}`
        const data = active.getData(prefix)
        if(isDynamicRoot(data)){
            root = data
            rootPartCount = index+1
            continue
        }
        const classProperty = makeClassPropertyRoot(active,prefix)
        if(classProperty){
            root = classProperty
            rootPartCount = index+1
        }
    }
    if(!root){
        return null
    }
    const steps:DynamicJSONStep[] = []
    for(const part of parsed.parts.slice(rootPartCount)){
        if(part.kind==='property'){
            steps.push({kind:'property',key:part.value})
            continue
        }
        const value = part.value
        if(/^(['"])(?:\\.|(?!\1)[\s\S])*\1$/.test(value)){
            steps.push({
                kind:'property',
                key:decodeStringEscapes(getStringLiteralContents(value))
            })
        }else if(/^[a-z_$][\w$]*$/i.test(value)&&active.getData(value)?.type==='string'){
            steps.push({kind:'key',expression:value,source:active.getData(value)!})
        }else{
            const stringProperty = /^[a-z_$][\w.$]*$/i.test(value)
                ? makeStringPropertySource(active,value)
                : null
            if(stringProperty){
                steps.push({kind:'key',expression:value,source:stringProperty})
                continue
            }
            steps.push({kind:'index',expression:value,parsed:parseIndex?.(value)??null})
        }
    }
    return {root,steps}
}

function emitRootValue(root:DataElement,ASM:Asm){
    const instance = root.classPropertyInstance
    if(instance&&root.classPropertyOffset!==null){
        if(instance.isParameter){
            ASM.addCode(`mov rdx, ${instance.name}`)
        }else if(instance.isHeapAllocated||instance.isReferenceAlias){
            ASM.addCode(`mov rdx, [${instance.name}]`)
        }else{
            ASM.addCode(`lea rdx, [${instance.name}]`)
        }
        if(root.classPropertyOffset){
            ASM.addCode(`add rdx, ${root.classPropertyOffset}`)
        }
        ASM.addCode('mov rax, [rdx]')
        return
    }
    if(root.isParameter){
        ASM.addCode(`mov rax, ${root.name}`)
    }else if(root.isHeapAllocated||root.isReferenceAlias){
        ASM.addCode(`mov rax, [${root.name}]`)
    }else{
        ASM.addCode(`mov rax, [${root.name}]`)
    }
}

export function emitDynamicJSONNode(
    access:DynamicJSONAccess,
    ASM:Asm,
    emitIndex:(expression:Expression|null,source:string)=>void
){
    ensureJSONRuntime(ASM)
    emitRootValue(access.root,ASM)
    for(const step of access.steps){
        const id = ++accessId
        const node = `__ds_json_node_${id}`
        ASM.addData(`${node} dq 0`)
        ASM.addCode(`mov [${node}], rax`)
        if(step.kind==='property'){
            const key = `__ds_json_key_${id}`
            ASM.addData(`${key} ${stringData(step.key)}`)
            ASM.addCode(`mov rcx, [${node}]`)
            ASM.addCode(`lea rdx, [${key}]`)
            ASM.addCode('sub rsp, 40')
            ASM.addCode('call __ds_json_get_property')
            ASM.addCode('add rsp, 40')
            continue
        }
        if(step.kind==='key'){
            const keyPointer = `__ds_json_key_pointer_${id}`
            ASM.addData(`${keyPointer} dq 0`)
            emitDynamicJSONStringPointer(step.source,ASM)
            ASM.addCode(`mov [${keyPointer}], rax`)
            ASM.addCode(`mov rcx, [${node}]`)
            ASM.addCode(`mov rdx, [${keyPointer}]`)
            ASM.addCode('sub rsp, 40')
            ASM.addCode('call __ds_json_get_property')
            ASM.addCode('add rsp, 40')
            continue
        }
        emitIndex(step.parsed,step.expression)
        ASM.addCode('mov rdx, rax')
        ASM.addCode(`mov rcx, [${node}]`)
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call __ds_json_get_index')
        ASM.addCode('add rsp, 40')
    }
}

export function emitDynamicJSONStringPointer(source:DataElement,ASM:Asm){
    const instance = source.classPropertyInstance
    if(instance&&source.classPropertyOffset!==null){
        if(instance.isParameter){
            ASM.addCode(`mov rdx, ${instance.name}`)
        }else if(instance.isHeapAllocated||instance.isReferenceAlias){
            ASM.addCode(`mov rdx, [${instance.name}]`)
        }else{
            ASM.addCode(`lea rdx, [${instance.name}]`)
        }
        if(source.classPropertyOffset){
            ASM.addCode(`add rdx, ${source.classPropertyOffset}`)
        }
        ASM.addCode('mov rax, [rdx]')
    }else{
        if(source.type!=='string'||source.isArray){
            throw new Error(`Dynamic JSON object key "${source.name}" must be a string`)
        }
        ASM.addCode(source.isParameter
            ? `mov rax, ${source.name}`
            : `mov rax, [${source.name}]`)
    }
}
