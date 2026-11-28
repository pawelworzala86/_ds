import Asm from '../../asm.ts'
import DataElement, {getNumericKind,type JsonValue} from '../dataElement.ts'
import {stringData,stringLiteralData} from '../../stringLiteral.ts'
import {getClassPropertyOffset} from '../clasElement.ts'
import {splitTopLevelArrayValues} from '../data/arrays.ts'
import {ensureJSONRuntime} from '../data/jsonRuntime.ts'
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
        const emitText = (text:string,prefix='')=>{
            const label = `__ds_console_log_text_${++consoleLogId}`
            ASM.addData(`${label} ${stringData(text)}`)
            emitPrintf(`${prefix}%s`,`addr ${label}`)
        }
        const emitJsonValue:(value:JsonValue,prefix?:string)=>void = (value,prefix='')=>{
            if(typeof value==='string'){
                emitText("'",prefix)
                emitText(value)
                emitText("'")
            }else if(Array.isArray(value)){
                emitText('[',prefix)
                value.forEach((item,index)=>{
                    if(index){
                        emitText(', ')
                    }
                    emitJsonValue(item)
                })
                emitText(']')
            }else if(value!==null&&typeof value==='object'){
                const properties = Object.entries(value)
                emitText('{',prefix)
                properties.forEach(([name,item],index)=>{
                    if(index){
                        emitText(', ')
                    }
                    emitText(`${name}: `)
                    emitJsonValue(item)
                })
                emitText('}')
            }else{
                emitText(String(value),prefix)
            }
        }
        const emitBoolean = (address:string,prefix='')=>{
            const id = ++consoleLogId
            const trueLabel = `__ds_console_log_true_${id}`
            const falseLabel = `__ds_console_log_false_${id}`
            const trueBranch = `__ds_console_log_boolean_true_${id}`
            const done = `__ds_console_log_boolean_done_${id}`
            ASM.addData(`${trueLabel} ${stringData('true')}`)
            ASM.addData(`${falseLabel} ${stringData('false')}`)
            ASM.addCode(`mov rax, qword ${address}`)
            ASM.addCode('test rax, rax')
            ASM.addCode(`jnz ${trueBranch}`)
            ASM.addCode(`lea rdx, [${falseLabel}]`)
            ASM.addCode(`jmp ${done}`)
            ASM.addCode(`${trueBranch}:`)
            ASM.addCode(`lea rdx, [${trueLabel}]`)
            ASM.addCode(`${done}:`)
            emitPrintf(`${prefix}%s`,'rdx')
        }
        const emitRootPointer = (data:DataElement)=>{
            if(data.isParameter){
                ASM.addCode(`mov rax, ${data.name}`)
            }else if(data.isHeapAllocated||data.isReferenceAlias){
                ASM.addCode(`mov rax, [${data.name}]`)
            }else if(data.name==='rsi'){
                ASM.addCode('mov rax, rsi')
            }else{
                ASM.addCode(`lea rax, [${data.name}]`)
            }
        }
        const emitScalar = (type:string|null,address:string,prefix='',numericKind:'integer'|'float'='integer')=>{
            if(type==='string'){
                emitText("'",prefix)
                ASM.addCode(`mov rdx, qword ${address}`)
                emitPrintf(`${prefix}%s`,'rdx')
                emitText("'")
            }else if(type==='boolean'){
                emitBoolean(address,prefix)
            }else if(type==='null'){
                emitText('null',prefix)
            }else if(type==='number'){
                emitPrintf(`${prefix}${numericKind==='float'?'%f':'%lld'}`,address,numericKind==='float')
            }else{
                ASM.addCode(`mov rdx, qword ${address}`)
                emitPrintf(`${prefix}%p`,'rdx')
            }
        }
        const getClassProperties = (data:DataElement)=>{
            const classType = data.classType?call.getClass(data.classType):null
            return {
                classType,
                properties:data.classLayoutProps??classType?.props??null
            }
        }
        const emitObjectAtBase:(data:DataElement,baseLabel:string,prefix?:string)=>void
            = (data,baseLabel,prefix='')=>{
                const {classType,properties} = getClassProperties(data)
                if(!properties){
                    throw new Error(`Unable to resolve object layout for console.log argument "${data.name}"`)
                }
                emitText('{',prefix)
                properties.forEach((property,index)=>{
                    const propertyName = property.name??''
                    const offset = classType
                        ? getClassPropertyOffset(
                            classType,
                            propertyName,
                            name=>call.getClass(name)
                        )
                        : index*8
                    if(offset===null){
                        throw new Error(`Unable to resolve object property "${propertyName}" for console.log`)
                    }
                    emitText(`${index?', ':''}${propertyName}: `)
                    if(property.classType&&!property.isArray){
                        const nested = `__ds_console_log_object_${++consoleLogId}`
                        ASM.addData(`${nested} dq 0`)
                        ASM.addCode(`mov rax, [${baseLabel}]`)
                        if(offset){
                            ASM.addCode(`add rax, ${offset}`)
                        }
                        ASM.addCode(`mov [${nested}], rax`)
                        const nestedData = new DataElement('let',propertyName,property.type??'',property.value??'')
                        nestedData.classType = property.classType
                        nestedData.classLayoutProps = property.classLayoutProps
                        emitObjectAtBase(nestedData,nested)
                    }else if(property.isArray){
                        if(property.type==='any'&&Array.isArray(property.jsonValue)){
                            emitJsonValue(property.jsonValue)
                            return
                        }
                        const arrayBase = `__ds_console_log_array_${++consoleLogId}`
                        ASM.addData(`${arrayBase} dq 0`)
                        ASM.addCode(`mov rax, [${baseLabel}]`)
                        if(offset){
                            ASM.addCode(`add rax, ${offset}`)
                        }
                        ASM.addCode(`mov [${arrayBase}], rax`)
                        const values = property.arrayObjectValues
                            ? property.arrayObjectValues.map(()=>'0')
                            : splitTopLevelArrayValues(property.value??'')
                        emitArrayAtBase(property,arrayBase,values.length)
                    }else{
                        const fieldValue = `__ds_console_log_field_${++consoleLogId}`
                        ASM.addData(`${fieldValue} dq 0`)
                        ASM.addCode(`mov rdx, [${baseLabel}]`)
                        if(offset){
                            ASM.addCode(`add rdx, ${offset}`)
                        }
                        ASM.addCode('mov rax, [rdx]')
                        ASM.addCode(`mov [${fieldValue}], rax`)
                        emitScalar(property.type,`[${fieldValue}]`,'',property.numericKind)
                    }
                })
                emitText('}')
            }
        const emitArrayValue=(array:DataElement,valueLabel:string,index:number,prefix='')=>{
            if(array.classType){
                const objectBase = `__ds_console_log_object_${++consoleLogId}`
                ASM.addData(`${objectBase} dq 0`)
                ASM.addCode(`mov rax, qword [${valueLabel}]`)
                ASM.addCode(`mov [${objectBase}], rax`)
                const objectData = new DataElement('let',array.name??'',array.classType,'0')
                objectData.classLayoutProps = array.arrayObjectValues?.[index]??null
                emitObjectAtBase(objectData,objectBase,prefix)
            }else if(array.type==='any'&&Array.isArray(array.jsonValue)
                &&array.jsonValue[index]!==undefined){
                emitJsonValue(array.jsonValue[index],prefix)
            }else{
                emitScalar(array.type,`[${valueLabel}]`,prefix,array.numericKind)
            }
        }
        const emitArrayAtBase=(array:DataElement,baseLabel:string,length:number,prefix='')=>{
            emitText('[',prefix)
            for(let index=0;index<length;index++){
                if(index){
                    emitText(', ')
                }
                const valueLabel = `__ds_console_log_array_value_${++consoleLogId}`
                ASM.addData(`${valueLabel} dq 0`)
                ASM.addCode(`mov rdx, [${baseLabel}]`)
                ASM.addCode(`mov rax, [rdx+${index*8}]`)
                ASM.addCode(`mov [${valueLabel}], rax`)
                emitArrayValue(array,valueLabel,index)
            }
            emitText(']')
        }
        const emitAggregate=(param:Call['params'][number],data:DataElement,prefix:string)=>{
            if(data.isArray&&data.typedArrayValues){
                emitText('[',prefix)
                data.typedArrayValues.forEach((value,index)=>{
                    if(index){
                        emitText(', ')
                    }
                    emitText(`${value}${typeof value==='bigint'?'n':''}`)
                })
                emitText(']')
                return true
            }
            if(data.isArray&&data.type==='any'&&Array.isArray(data.jsonValue)){
                emitJsonValue(data.jsonValue,prefix)
                return true
            }
            if(data.isArray){
                const baseLabel = `__ds_console_log_array_base_${++consoleLogId}`
                const indexLabel = `__ds_console_log_array_index_${consoleLogId}`
                const valueLabel = `__ds_console_log_array_item_${consoleLogId}`
                const lengthLabel = `__ds_console_log_array_length_${consoleLogId}`
                ASM.addData(`${baseLabel} dq 0`)
                if(data.dynamicArray){
                    ASM.addData(`${indexLabel} dq 0`)
                    ASM.addData(`${valueLabel} dq 0`)
                    ASM.addData(`${lengthLabel} dq 0`)
                    const undefinedValue = `__ds_console_log_array_undefined_${consoleLogId}`
                    ASM.addData(`${undefinedValue} dq 0x7ff8000000000001`)
                    if(data.isParameter){
                        ASM.addCode(`mov rax, ${data.name}`)
                        ASM.addCode(`mov rcx, [rax+8]`)
                        ASM.addCode('mov rax, [rax]')
                    }else{
                        ASM.addCode(`mov rax, [${data.name}]`)
                        ASM.addCode(`mov rcx, [${data.name}__length]`)
                    }
                    ASM.addCode(`mov [${baseLabel}], rax`)
                    ASM.addCode(`mov [${lengthLabel}], rcx`)
                    ASM.addCode(`mov qword [${indexLabel}], 0`)
                    const id = consoleLogId
                    const loop = `__ds_console_log_array_loop_${id}`
                    const done = `__ds_console_log_array_done_${id}`
                    const next = `__ds_console_log_array_next_${id}`
                    emitText('[',prefix)
                    ASM.addCode(`${loop}:`)
                    ASM.addCode(`mov rax, [${indexLabel}]`)
                    ASM.addCode(`cmp rax, [${lengthLabel}]`)
                    ASM.addCode(`jnb ${done}`)
                    ASM.addCode('test rax, rax')
                    ASM.addCode(`jz ${next}`)
                    emitText(', ')
                    ASM.addCode(`${next}:`)
                    ASM.addCode(`mov rax, [${indexLabel}]`)
                    ASM.addCode('shl rax, 3')
                    ASM.addCode(`mov rdx, [${baseLabel}]`)
                    ASM.addCode('add rdx, rax')
                    ASM.addCode('mov rax, [rdx]')
                    ASM.addCode(`mov [${valueLabel}], rax`)
                    ASM.addCode(`cmp rax, qword [${undefinedValue}]`)
                    const defined = `__ds_console_log_array_defined_${id}`
                    ASM.addCode(`jne ${defined}`)
                    emitText('undefined')
                    ASM.addCode(`jmp ${defined}_done`)
                    ASM.addCode(`${defined}:`)
                    emitArrayValue(data,valueLabel,0)
                    ASM.addCode(`${defined}_done:`)
                    ASM.addCode(`inc qword [${indexLabel}]`)
                    ASM.addCode(`jmp ${loop}`)
                    ASM.addCode(`${done}:`)
                    emitText(']')
                }else{
                    const length = data.arrayLength
                        ??data.arrayObjectValues?.length
                        ??splitTopLevelArrayValues(data.value??'').length
                    if(param.classPropertyInstance&&param.classProperty){
                        const root = param.classPropertyInstance
                        const rootClass = root.classType?call.getClass(root.classType):null
                        const offset = rootClass
                            ? getClassPropertyOffset(
                                rootClass,
                                param.classPropertyOffsetPath??param.classProperty.name??'',
                                name=>call.getClass(name)
                            )
                            : null
                        if(offset===null){
                            throw new Error('Unable to resolve array property for console.log')
                        }
                        emitRootPointer(root)
                        if(offset){
                            ASM.addCode(`add rax, ${offset}`)
                        }
                    }else if(param.arrayElementAccess&&param.tempName){
                        throw new Error('Cannot log an array element as an array')
                    }else if(data.isParameter){
                        ASM.addCode(`mov rax, ${data.name}`)
                    }else{
                        ASM.addCode(`lea rax, [${data.name}]`)
                    }
                    ASM.addCode(`mov [${baseLabel}], rax`)
                    emitArrayAtBase(data,baseLabel,length,prefix)
                }
                return true
            }
            if(data.classType){
                const baseLabel = `__ds_console_log_object_base_${++consoleLogId}`
                ASM.addData(`${baseLabel} dq 0`)
                if(param.arrayElementAccess&&param.tempName){
                    ASM.addCode(`mov rax, [${param.tempName}]`)
                }else if(param.classPropertyInstance&&param.classProperty){
                    const root = param.classPropertyInstance
                    const rootClass = root.classType?call.getClass(root.classType):null
                    const offset = rootClass
                        ? getClassPropertyOffset(
                            rootClass,
                            param.classPropertyOffsetPath??param.classProperty.name??'',
                            name=>call.getClass(name)
                        )
                        : null
                    if(offset===null){
                        throw new Error('Unable to resolve object property for console.log')
                    }
                    emitRootPointer(root)
                    if(offset){
                        ASM.addCode(`add rax, ${offset}`)
                    }
                }else{
                    emitRootPointer(data)
                }
                ASM.addCode(`mov [${baseLabel}], rax`)
                emitObjectAtBase(data,baseLabel,prefix)
                return true
            }
            return false
        }

        if(call.consoleTemplateParts){
            for(const part of call.consoleTemplateParts){
                if(!part.argument){
                    if(part.text){
                        emitText(part.text)
                    }
                    continue
                }
                const argument = part.argument
                const value = argument.value instanceof DataElement?argument.value:null
                const type = argument.classProperty?.type??value?.type
                const code = argument.getCode(true)
                if(!code){
                    throw new Error('Unable to resolve console.log template expression')
                }
                if(argument.dynamicJSONAccess||value?.isDynamicJSON){
                    ensureJSONRuntime(ASM)
                    ASM.addCode(`mov rcx, ${code}`)
                    ASM.addCode('sub rsp, 40')
                    ASM.addCode('call __ds_json_stringify')
                    ASM.addCode('add rsp, 40')
                    emitPrintf('%s','rax')
                }else if(type==='string'){
                    emitPrintf('%s',code)
                }else if(type==='boolean'&&value){
                    emitBoolean(code)
                }else if(type==='number'||argument.expression){
                    const numericKind = argument.expression?.numericKind??value?.numericKind??'integer'
                    emitPrintf(numericKind==='float'?'%f':'%lld',code,numericKind==='float')
                }else{
                    throw new Error(`Unsupported console.log template expression "${argument.value}"`)
                }
            }
            emitPrintf('\n')
            return
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
            const data = value instanceof DataElement?value:null
            const isArrayElement = param.expression?.kind==='index'
            if(data&&!isArrayElement&&emitAggregate(param,data,prefix)){
                return
            }
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

            const type = param.classProperty?.type??data?.type
            if(param.dynamicJSONAccess
                ||data?.isDynamicJSON&&!data.isArray){
                const argument = param.getCode(true)
                if(!argument){
                    throw new Error('Unable to resolve dynamic JSON console.log argument')
                }
                ensureJSONRuntime(ASM)
                ASM.addCode(`mov rcx, ${argument}`)
                ASM.addCode('sub rsp, 40')
                ASM.addCode('call __ds_json_stringify')
                ASM.addCode('add rsp, 40')
                emitPrintf(`${prefix}%s`,'rax')
                return
            }
            if(type==='boolean'&&data&&(!data.isArray||isArrayElement)){
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
                    argument = (data.isProcedureLocal||data.isReferenceAlias)&&data.isHeapAllocated
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
