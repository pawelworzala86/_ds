import Asm from '../../asm.ts'
import DataElement, {getNumericKind} from '../dataElement.ts'
import {stringData,stringLiteralData} from '../../stringLiteral.ts'
import {splitTopLevelArrayValues} from './arrays.ts'
import {getTypedArrayInfo} from './typedArrays.ts'
import {getStructFields,getStructLayoutMembers,initializeStackStructStrings,initializeStructStrings} from './struct.ts'
import {nextObjectStringLabelId} from './ids.ts'
import {isPromiseType} from '../promise.ts'
import {getClassPropertyOffset} from '../clasElement.ts'
import type Data from '../data.ts'

function emitObjectAssign(data:Data,ASM:Asm){
    const target = data.element
    if(!target?.classType||!target.classLayoutProps){
        throw new Error('Object.assign target layout is not initialized')
    }
    const getClass = (name:string)=>data.parent!.getClass(name)
    for(const source of data.objectAssignSources){
        if(!source.classType){
            throw new Error(`Object.assign source "${source.name}" has no struct type`)
        }
        const sourceClass = getClass(source.classType)
        const sourceProperties = source.classLayoutProps??sourceClass?.props
        if(!sourceClass||!sourceProperties){
            throw new Error(`Object.assign source "${source.name}" has no struct layout`)
        }
        for(const property of sourceProperties){
            const targetProperty = target.classLayoutProps.find(value=>value.name===property.name)
            const sourceOffset = getClassPropertyOffset(sourceClass,property.name??'',getClass)
            const targetClass = getClass(target.classType)
            const targetOffset = targetClass
                ? getClassPropertyOffset(targetClass,property.name??'',getClass)
                : null
            if(!targetProperty||sourceOffset===null||targetOffset===null){
                throw new Error(`Unable to resolve Object.assign property "${property.name}"`)
            }
            ASM.addCode(source.isProcedureLocal
                ? source.isHeapAllocated
                    ? `mov rdx, [${source.name}]`
                    : `lea rdx, [${source.name}]`
                : `lea rdx, [${source.name}]`)
            if(sourceOffset){
                ASM.addCode(`add rdx, ${sourceOffset}`)
            }
            ASM.addCode('mov rax, [rdx]')
            ASM.addCode(target.isProcedureLocal
                ? target.isHeapAllocated
                    ? `mov rdx, [${target.name}]`
                    : `lea rdx, [${target.name}]`
                : `lea rdx, [${target.name}]`)
            if(targetOffset){
                ASM.addCode(`add rdx, ${targetOffset}`)
            }
            ASM.addCode('mov [rdx], rax')
        }
    }
}

export function emitDataAsm(data:Data,ASM:Asm){

        if(!data.element){
            return
        }
        if(data.element.isConstAlias){
            ASM.addCode(`${data.element.name} = ${data.element.value}`)
            return
        }
        if(data.runtimeCallInitializer){
            if(data.element.isProcedureLocal){
                ASM.addCode(`local ${data.element.name} dq 0`)
            }else{
                ASM.addData(`${data.element.name} dq 0`)
            }
            return
        }
        if(data.element.isReferenceAlias){
            if(data.element.isProcedureLocal){
                ASM.addCode(`local ${data.element.name} dq 0`)
            }else{
                ASM.addData(`${data.element.name} dq 0`)
            }
            return
        }
        if(isPromiseType(data.element.type??undefined)&&data.element.type!=='Promise'){
            const state = `${data.element.name}__state`
            const value = `${data.element.name}__value`
            if(data.element.isProcedureLocal){
                ASM.addCode(`local ${state} dq 0`)
                ASM.addCode(`local ${value} dq 0`)
            }else{
                ASM.addData(`${state} dq 0`)
                ASM.addData(`${value} dq 0`)
            }
            return
        }
        if(data.element.typedArrayKind){
            const bytes = data.element.typedArrayBytes??[]
            const value = bytes.length?bytes.join(', '):'0'
            if(data.element.isProcedureLocal){
                ASM.addCode(`local ${data.element.name} db ${value}`)
            }else{
                ASM.addData(`${data.element.name} db ${value}`)
            }
            return
        }
        if(data.element!.isProcedureLocal&&data.element!.isArray&&data.element!.type==='number'&&!data.element!.dynamicArray){
            const values = splitTopLevelArrayValues(data.element!.value??'')
            if(data.element!.numericKind==='float'){
                ASM.addCode(`local ${data.element!.name} dq ${values.map(()=>0).join(', ')}`)
                values.forEach((value,index)=>{
                    const literal = getNumericKind(value)==='integer'?`${Number(value)}.0`:value
                    const label = `__ds_local_array_literal_${data.element!.name}_${index}`
                    ASM.addData(`${label} dq ${literal}`)
                    ASM.addCode(`movsd xmm0, qword [${label}]`)
                    ASM.addCode(`movsd qword [${data.element!.name}+${index*8}], xmm0`)
                })
            }else{
                ASM.addCode(`local ${data.element!.name} dq ${values.join(', ')}`)
            }
            return
        }
        if(data.element!.isProcedureLocal&&data.element!.classType&&!data.element!.isArray){
            const classType = data.parent?.getClass(data.element!.classType)
            const properties = data.element!.classLayoutProps??classType?.props
            if(!properties){
                throw new Error(`Unknown class type "${data.element!.classType}" for local "${data.element!.name}"`)
            }
            const fields = getStructFields(properties,name=>data.parent!.getClass(name))
            const heapAllocated = data.element!.isHeapAllocated
            if(heapAllocated){
                ASM.addCode(`local ${data.element!.name} dq 0`)
                ASM.addImport('msvcrt','calloc')
                ASM.addCode(`mov rcx, ${Math.max(1,fields.length)}`)
                ASM.addCode('mov rdx, 8')
                ASM.addCode('sub rsp, 40')
                ASM.addCode('call [calloc]')
                ASM.addCode('add rsp, 40')
                ASM.addCode('test rax, rax')
                ASM.addCode(`jz __ds_struct_alloc_error_${data.element!.name}`)
                ASM.addCode(`mov [${data.element!.name}], rax`)
                ASM.addCode(`jmp __ds_struct_alloc_ready_${data.element!.name}`)
                ASM.addCode(`__ds_struct_alloc_error_${data.element!.name}:`)
                ASM.addCode('mov ecx, 1')
                ASM.addCode('sub rsp, 40')
                ASM.addImport('kernel32','ExitProcess')
                ASM.addCode('call [ExitProcess]')
                ASM.addCode('add rsp, 40')
                ASM.addCode(`__ds_struct_alloc_ready_${data.element!.name}:`)
            }else{
                ASM.addCode(`local ${data.element!.name} dq ${fields.map(()=>0).join(', ')||'0'}`)
            }
            fields.forEach((property,index)=>{
                const value = property.type==='string'?null:property.value
                if(!value||value==='0'){
                    return
                }
                if(property.type==='number'&&getNumericKind(value)==='float'){
                    const label = `__ds_local_struct_literal_${data.element!.name}_${index}`
                    ASM.addData(`${label} dq ${value}`)
                    ASM.addCode(`movsd xmm0, qword [${label}]`)
                    ASM.addCode(heapAllocated
                        ? `mov rdx, [${data.element!.name}]`
                        : `lea rdx, [${data.element!.name}]`)
                    ASM.addCode(`movsd qword [rdx+${index*8}], xmm0`)
                }else{
                    ASM.addCode(`mov rax, ${value}`)
                    ASM.addCode(heapAllocated
                        ? `mov rdx, [${data.element!.name}]`
                        : `lea rdx, [${data.element!.name}]`)
                    ASM.addCode(`mov [rdx+${index*8}], rax`)
                }
            })
            initializeStackStructStrings(ASM,data.element!.name!,fields,heapAllocated)
            if(data.objectAssignSources.length){
                emitObjectAssign(data,ASM)
            }
            return
        }
        if(data.element!.isProcedureLocal&&!(data.element!.isArray&&data.element!.dynamicArray)){
            if(data.element!.type==='number'&&data.element!.numericKind==='float'){
                const label = `__ds_local_literal_${data.element!.name}`
                ASM.addCode(`local ${data.element!.name} dq 0`)
                ASM.addData(`${label} dq ${data.element!.value}`)
                ASM.addCode(`movsd xmm0, qword [${label}]`)
                ASM.addCode(`movsd qword [${data.element!.name}], xmm0`)
                return
            }
            ASM.addCode(`local ${data.element!.name} dq ${data.element!.value}`)
            return
        }
        let type = 'dq'
        let value = data.element!.value
        if(data.element!.isArray){
            if(data.element!.dynamicArray){
                const values = splitTopLevelArrayValues(value??'')
                const lengthName = `${data.element!.name}__length`
                const capacityName = `${data.element!.name}__capacity`
                const addArrayStorage = (name:string,initializer:string)=>{
                    if(data.element!.isProcedureLocal){
                        ASM.addCode(`local ${name} dq ${initializer}`)
                    }else{
                        ASM.addData(`${name} dq ${initializer}`)
                    }
                }
                if(data.arrayInitializerCall){
                    addArrayStorage(data.element!.name!, '0')
                    addArrayStorage(lengthName, '0')
                    addArrayStorage(capacityName, '0')
                    data.arrayInitializerCall.asm(ASM)
                    ASM.addCode('mov rdx, rax')
                    ASM.addCode('mov rax, [rdx]')
                    ASM.addCode(`mov [${data.element!.name}], rax`)
                    ASM.addCode('mov rax, [rdx+8]')
                    ASM.addCode(`mov [${lengthName}], rax`)
                    ASM.addCode('mov rax, [rdx+16]')
                    ASM.addCode(`mov [${capacityName}], rax`)
                    return
                }
                const capacity = Math.max(4,values.length)
                addArrayStorage(data.element!.name!, '0')
                addArrayStorage(lengthName, `${values.length}`)
                addArrayStorage(capacityName, `${capacity}`)
                ASM.addImport('msvcrt','malloc')
                ASM.addCode(`mov rcx, ${capacity*8}`)
                ASM.addCode('sub rsp, 40')
                ASM.addCode('call [malloc]')
                ASM.addCode('add rsp, 40')
                const allocationError = `__ds_array_init_error_${data.element!.name}`
                const allocationReady = `__ds_array_init_ready_${data.element!.name}`
                ASM.addCode('test rax, rax')
                ASM.addCode(`jz ${allocationError}`)
                ASM.addCode(`mov [${data.element!.name}], rax`)
                const undefinedValue = `__ds_array_undefined_${data.element!.name}`
                ASM.addData(`${undefinedValue} dq 0x7ff8000000000001`)
                ASM.addCode(`mov rdx, qword [${undefinedValue}]`)
                for(let index=0;index<capacity;index++){
                    ASM.addCode(`mov qword [rax+${index*8}], rdx`)
                }
                if(data.element!.classType){
                    values.forEach((item,index)=>{
                        const label = `${data.element!.name}_${index}`
                        ASM.addData(`${label} ${data.element!.classType}`)
                        const classType = data.parent?.getClass(data.element!.classType!)
                        if(classType){
                            initializeStructStrings(ASM,label,classType.props,name=>data.parent!.getClass(name))
                        }
                        ASM.addCode(`lea rax, [${label}]`)
                        ASM.addCode(`mov rdx, [${data.element!.name}]`)
                        ASM.addCode(`mov [rdx+${index*8}], rax`)
                    })
                }else if(data.element!.type==='string'){
                    values.forEach((item,index)=>{
                        const label = `${data.element!.name}_${index}`
                        ASM.addData(`${label} ${stringLiteralData(item)}`)
                        ASM.addCode(`lea rax, [${label}]`)
                        ASM.addCode(`mov rdx, [${data.element!.name}]`)
                        ASM.addCode(`mov [rdx+${index*8}], rax`)
                    })
                }else{
                    values.forEach((item,index)=>{
                        const literal = data.element!.numericKind==='float'&&getNumericKind(item)==='integer'
                            ? `${Number(item)}.0`
                            : item
                        if(data.element!.numericKind==='float'){
                            ASM.addCode(`movsd xmm0, qword [__ds_array_literal_${data.element!.name}_${index}]`)
                            ASM.addCode(`mov rdx, [${data.element!.name}]`)
                            ASM.addCode(`movsd qword [rdx+${index*8}], xmm0`)
                            ASM.addData(`__ds_array_literal_${data.element!.name}_${index} dq ${literal}`)
                        }else{
                            ASM.addCode(`mov rax, ${literal}`)
                            ASM.addCode(`mov rdx, [${data.element!.name}]`)
                            ASM.addCode(`mov [rdx+${index*8}], rax`)
                        }
                    })
                }
                ASM.addCode(`jmp ${allocationReady}`)
                ASM.addCode(`${allocationError}:`)
                ASM.addCode('mov ecx, 1')
                ASM.addCode('sub rsp, 40')
                ASM.addImport('kernel32','ExitProcess')
                ASM.addCode('call [ExitProcess]')
                ASM.addCode('add rsp, 40')
                ASM.addCode(`${allocationReady}:`)
                return
            }
            if(data.element!.arrayObjectValues){
                const objects = data.element!.arrayObjectValues
                ASM.addData(`${data.element!.name} dq ${objects.map(()=>0).join(', ')}`)
                objects.forEach((properties,index)=>{
                    const label = `${data.element!.name}_${index}`
                    const fields = getStructFields(properties,name=>data.parent!.getClass(name))
                    ASM.addData(`${label} dq ${fields.map(property=>property.type==='string'?'0':property.value||'0').join(', ')||'0'}`)
                    initializeStackStructStrings(ASM,label,fields)
                    ASM.addCode(`lea rax, [${label}]`)
                    ASM.addCode(`mov [${data.element!.name}+${index*8}], rax`)
                })
                return
            }
            if(data.element!.classType){
                const instances = splitTopLevelArrayValues(value??'')
                const labels = instances.map((item,index)=>{
                    const label = `${data.element!.name}_${index}`
                    ASM.addData(`${label} ${data.element!.classType}`)
                    const classType = data.parent?.getClass(data.element!.classType!)
                    if(classType){
                        initializeStructStrings(ASM,label,classType.props,name=>data.parent!.getClass(name))
                    }
                    return label
                })
                ASM.addData(`${data.element!.name} dq ${Array(instances.length).fill(0).join(', ')}`)
                labels.forEach((label,index)=>{
                    ASM.addCode(`lea rax, [${label}]`)
                    ASM.addCode(`mov [${data.element!.name}+${index*8}], rax`)
                })
                return
            }
            if(data.element!.type==='string'||data.element!.type==='string[]'){
                const literals = splitTopLevelArrayValues(value??'')
                const labels = literals.map((item,index)=>{
                    const label = `${data.element!.name}_${index}`
                    ASM.addData(`${label} ${stringLiteralData(item)}`)
                    return label
                })
                ASM.addData(`${data.element!.name} dq ${Array(literals.length).fill(0).join(', ')}`)
                labels.forEach((label,index)=>{
                    ASM.addCode(`lea rax, [${label}]`)
                    ASM.addCode(`mov [${data.element!.name}+${index*8}], rax`)
                })
                return
            }
            if(data.element!.numericKind==='float'){
                value = value!.split(',').map(item=>{
                    const literal = item.trim()
                    return getNumericKind(literal)==='integer'?`${Number(literal)}.0`:literal
                }).join(', ')
            }
            ASM.addData(`${data.element!.name} dq ${value}`)
            return
        }
        if(data.element!.classType){
            if(data.element!.classLayoutType&&data.element!.classLayoutProps){
                const getClass = (name:string)=>data.parent!.getClass(name)
                const members = getStructLayoutMembers(data.element!.classLayoutProps,getClass)
                if(!members.length){
                    members.push('    __ds_empty dq 0')
                }
                ASM.addCode([`struct ${data.element!.classLayoutType}`,...members,'end struct'].join('\n'))
                ASM.addData(`${data.element!.name} ${data.element!.classLayoutType}`)
                initializeStructStrings(
                    ASM,
                    data.element!.name!,
                    data.element!.classLayoutProps,
                    name=>data.parent!.getClass(name)
                )
                if(data.objectAssignSources.length){
                    emitObjectAssign(data,ASM)
                }
            }else{
                ASM.addData(`${data.element!.name} ${data.element!.classType}`)
                const classType = data.parent?.getClass(data.element!.classType)
                if(classType){
                    initializeStructStrings(ASM,data.element!.name!,classType.props,name=>data.parent!.getClass(name))
                }
            }
            return
        }
        if(data.element!.type==='number'&&data.element!.numericKind==='float'&&/e/i.test(value??'')&&!/f$/i.test(value??'')){
            value += 'f'
        }
        if(data.element!.type=='string'){
            const label = `__ds_string_literal_${nextObjectStringLabelId()}`
            ASM.addData(`${label} ${stringData(value??'')}`)
            ASM.addData(`${data.element!.name} dq 0`)
            ASM.addCode(`lea rax, [${label}]`)
            ASM.addCode(`mov [${data.element!.name}], rax`)
            return
        }
        const asmData:string = `${data.element!.name} ${type} ${value}`
        ASM.addData(asmData)
}
