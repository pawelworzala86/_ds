import Asm from '../../asm.ts'
import Base from '../base.ts'
import DataElement from '../dataElement.ts'
import ClassElement from '../clasElement.ts'
import {getStringLiteralContents,stringData,stringLiteralData} from '../../stringLiteral.ts'
import {splitTopLevelArrayValues} from './arrays.ts'
import {nextObjectStringLabelId,nextStructLayoutId} from './ids.ts'
import type {ObjectLiteralProperty} from './types.ts'

export function initializeStructStrings(ASM:Asm,instanceName:string,properties:DataElement[],getClass:(name:string)=>ClassElement|null,prefix=''){
    for(const property of properties){
        if(property.classType&&!property.isArray){
            const nestedClass = getClass(property.classType)
            if(nestedClass){
                initializeStructStrings(ASM,instanceName,nestedClass.props,getClass,`${prefix}${property.name}_`)
            }
            continue
        }
        if(property.isArray&&property.type==='string'){
            splitTopLevelArrayValues(property.value??'').forEach((value,index)=>{
                const label = `__ds_object_string_${nextObjectStringLabelId()}`
                ASM.addData(`${label} ${stringLiteralData(value)}`)
                ASM.addCode(`lea rax, [${label}]`)
                ASM.addCode(`mov [${instanceName}.${prefix}${property.name}+${index*8}], rax`)
            })
            continue
        }
        if(property.isArray&&property.arrayObjectValues){
            property.arrayObjectValues.forEach((values,index)=>{
                const label = `__ds_object_array_${nextObjectStringLabelId()}`
                const fields = getStructFields(values,getClass)
                ASM.addData(`${label} dq ${fields.map(field=>field.type==='string'?'0':field.value||'0').join(', ')||'0'}`)
                initializeStackStructStrings(ASM,label,fields)
                ASM.addCode(`lea rax, [${label}]`)
                ASM.addCode(`mov [${instanceName}.${prefix}${property.name}+${index*8}], rax`)
            })
            continue
        }
        if(property.type!=='string'){
            continue
        }
        const label = `__ds_object_string_${nextObjectStringLabelId()}`
        ASM.addData(`${label} ${stringData(property.value??'')}`)
        ASM.addCode(`lea rax, [${label}]`)
        ASM.addCode(`mov [${instanceName}.${prefix}${property.name}], rax`)
    }
}

export function getStructFields(properties:DataElement[],getClass:(name:string)=>ClassElement|null):DataElement[]{
    return properties.flatMap(property=>{
        if(property.classType&&!property.isArray){
            const nestedClass = getClass(property.classType)
            if(nestedClass){
                return [
                    ...(nestedClass.runtimeTypeId===null
                        ? []
                        : [createRuntimeTypeField(nestedClass.runtimeTypeId)]),
                    ...getStructFields(nestedClass.props,getClass)
                ]
            }
        }
        if(property.isArray){
            if(property.dynamicArray){
                return ['','__length','__capacity'].map(suffix=>{
                    const field = new DataElement('let',`${property.name}${suffix}`,'number','0')
                    field.numericKind = 'integer'
                    return field
                })
            }
            const values = splitTopLevelArrayValues(property.value??'')
            return (values.length?values:['0']).map(value=>{
                const fieldValue = property.type==='string'&&/^(['"])/.test(value)
                    ? getStringLiteralContents(value)
                    : value
                const field = new DataElement(property.kind??'let',property.name??'',property.type??'',fieldValue)
                field.numericKind = property.numericKind
                field.jsonValue = property.jsonValue
                return field
            })
        }
        return [property]
    })
}

export function getClassInstanceFields(
    classType:ClassElement,
    properties:DataElement[],
    getClass:(name:string)=>ClassElement|null
):DataElement[]{
    return [
        ...(classType.runtimeTypeId===null
            ? []
            : [createRuntimeTypeField(classType.runtimeTypeId)]),
        ...getStructFields(properties,getClass)
    ]
}

function createRuntimeTypeField(runtimeTypeId:number){
    const field = new DataElement(
        'let',
        `__ds_runtime_type_${runtimeTypeId}`,
        'number',
        String(runtimeTypeId)
    )
    field.isRuntimeTypeTag = true
    return field
}

export function getStructLayoutMembers(properties:DataElement[],getClass:(name:string)=>ClassElement|null,prefix=''):string[]{
    return properties.flatMap(property=>{
        if(property.classType&&!property.isArray){
            const nestedClass = getClass(property.classType)
            return nestedClass
                ? [
                    ...(nestedClass.runtimeTypeId===null
                        ? []
                        : [`    ${prefix}${property.name}__ds_runtime_type_${nestedClass.runtimeTypeId} dq ${nestedClass.runtimeTypeId}`]),
                    ...getStructLayoutMembers(nestedClass.props,getClass,`${prefix}${property.name}_`)
                ]
                : []
        }
        if(property.isArray){
            if(property.dynamicArray){
                return [
                    `    ${prefix}${property.name} dq 0`,
                    `    ${prefix}${property.name}__length dq 0`,
                    `    ${prefix}${property.name}__capacity dq 0`
                ]
            }
            const values = property.arrayObjectValues
                ? property.arrayObjectValues.map(()=>'0')
                : splitTopLevelArrayValues(property.value??'')
            const initializers = (values.length?values:['0']).map(value=>
                property.type==='string'?'0':value||'0'
            )
            return [`    ${prefix}${property.name} dq ${initializers.join(', ')}`]
        }
        return [`    ${prefix}${property.name} dq ${property.type==='string'?'0':property.value||'0'}`]
    })
}

export function initializeStackStructStrings(ASM:Asm,instanceName:string,properties:DataElement[],heapAllocated=false){
    properties.forEach((property,index)=>{
        if(property.type!=='string'){
            return
        }
        const label = `__ds_object_string_${nextObjectStringLabelId()}`
        ASM.addData(`${label} ${stringData(property.value??'')}`)
        ASM.addCode(`lea rax, [${label}]`)
        ASM.addCode(heapAllocated?`mov rdx, [${instanceName}]`:`lea rdx, [${instanceName}]`)
        ASM.addCode(`mov [rdx+${index*8}], rax`)
    })
}

export function parseObjectLiteral(tokens:string[]):ObjectLiteralProperty[]{
    if(tokens[0]!=='{'||tokens[tokens.length-1]!=='}'){
        throw new Error('Invalid struct initializer')
    }
    const properties:ObjectLiteralProperty[] = []
    let index = 1
    while(index<tokens.length-1){
        if(tokens[index]===','){
            index++
            continue
        }
        const name = tokens[index++]
        if(!/^[a-z_$][\w$]*$/i.test(name??'')||tokens[index++]!==':'){
            throw new Error('Invalid property in struct initializer')
        }
        const valueTokens:string[] = []
        let quote:string|null = null
        while(index<tokens.length-1){
            const token = tokens[index]
            if(quote){
                valueTokens.push(token)
                if(token===quote){
                    quote = null
                }
                index++
                continue
            }
            if(token==="'"||token==='"'){
                quote = token
                valueTokens.push(token)
                index++
                continue
            }
            if(token===','){
                break
            }
            valueTokens.push(token)
            index++
        }
        if(quote||!valueTokens.length){
            throw new Error(`Invalid initializer for struct property "${name}"`)
        }
        const value = valueTokens.join('')
        const stringLiteral = value.match(/^(['"])[\s\S]*\1$/)
        if(stringLiteral){
            properties.push({name,type:'string',value:getStringLiteralContents(value)})
        }else if(value==='true'||value==='false'){
            properties.push({name,type:'boolean',value:value==='true'?'1':'0'})
        }else if(/^[+-]?(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(value)){
            properties.push({name,type:'number',value})
        }else{
            throw new Error(`Struct property "${name}" must be initialized with a string or number literal`)
        }
        if(tokens[index]===','){
            index++
        }else if(index<tokens.length-1){
            throw new Error(`Expected ',' after struct property "${name}"`)
        }
    }
    return properties
}

export function createStructLayout(properties:ObjectLiteralProperty[],classType:ReturnType<Base['getClass']>|null,name:string):{type:string,props:DataElement[]}{
    const layoutProps = properties.map(property=>{
        const declaredProperty = classType?.props.find(prop=>prop.name===property.name)
        if(classType&&!declaredProperty){
            throw new Error(`Unknown property "${property.name}" in struct "${classType.name}"`)
        }
        if(declaredProperty&&declaredProperty.type!==property.type){
            throw new Error(`Property "${property.name}" in struct "${classType!.name}" must be a ${declaredProperty.type}`)
        }
        if(classType&&(declaredProperty?.isArray||declaredProperty?.classType)){
            throw new Error(`Struct initializer does not support array or nested property "${property.name}"`)
        }
        const element = new DataElement('let',property.name,property.type,property.value)
        element.classType = property.classType??null
        element.isArray = property.isArray??false
        element.dynamicArray = property.dynamicArray??false
        element.arrayObjectValues = property.arrayObjectValues??null
        element.jsonValue = property.jsonValue
        return element
    })
    if(classType){
        for(const property of classType.props){
            if(!properties.some(value=>value.name===property.name)){
                throw new Error(`Missing property "${property.name}" in struct initializer for "${classType.name}"`)
            }
        }
    }else if(!layoutProps.length){
        throw new Error(`Cannot infer struct type for empty initializer "${name}"`)
    }
    if(new Set(layoutProps.map(property=>property.name)).size!==layoutProps.length){
        throw new Error('Duplicate property in struct initializer')
    }
    return {type:`__ds_struct_${nextStructLayoutId()}`,props:layoutProps}
}

