import Asm from '../asm.ts'
import Base from './base.ts'
import {emitExpression, parseExpression, type Expression} from '../maths.ts'
import DataElement from './dataElement.ts'
import FuncElement from './funcElement.ts'
import Link from './link.ts'
import {getClassPropertyAccess, getClassPropertyOffset} from './clasElement.ts'

let argumentId = 0
let methodCallbackId = 0

export class FunctionArgument{
    scope:Base
    value:ReturnType<typeof Link.data>
    methodPointerName:string|null = null
    methodInstance:DataElement|null = null
    methodName:string|null = null
    methodClassType:string|null = null
    methodParamCount = 0
    expression:Expression|null = null
    tempName:string|null = null
    arrayPointerName:string|null = null
    classPropertyInstance:DataElement|null = null
    classProperty:DataElement|null = null
    classPropertyPath:string|null = null
    classPropertyOffsetPath:string|null = null
    arrayPropertyAccess:{array:DataElement,indexExpression:Expression,property:DataElement,offset:number}|null = null
    arrayElementAccess:{array:DataElement,indexExpression:Expression}|null = null
    addressOf:DataElement|null = null

    constructor(active:Base,text:string){
        this.scope = active
        this.value = Link.data(active,text)
        const address = text.match(/^&([a-z_$][\w.$]*)$/i)
        if(address){
            this.addressOf = active.getData(address[1])
            if(!this.addressOf){
                const access = getClassPropertyAccess(active,address[1])
                if(access){
                    const propertyValue = new DataElement('let',`${access.instance.name}.${access.path}`,access.property.type??'',access.property.value??'')
                    propertyValue.numericKind = access.property.numericKind
                    propertyValue.isArray = access.property.isArray
                    propertyValue.classType = access.property.classType
                    this.addressOf = propertyValue
                    this.classPropertyInstance = access.instance
                    this.classProperty = access.property
                    this.classPropertyPath = access.path
                    this.classPropertyOffsetPath = address[1].split('.').slice(1).join('.')
                }
            }
        }
        if(this.addressOf){
            this.value = this.addressOf
        }
        const quotedPropertyAccess = text.match(/^([a-z_$][\w.$]*)\[['"]([a-z_$][\w$]*)['"]\]$/i)
        if(quotedPropertyAccess){
            text = `${quotedPropertyAccess[1]}.${quotedPropertyAccess[2]}`
        }
        if(typeof this.value==='string'){
            const methodRef = text.match(/^([a-z_$][\w.$]*)\.([a-z_$][\w$]*)$/i)
            if(methodRef){
                const [,instanceName,methodName] = methodRef
                const instance = active.getData(instanceName)
                const classType = instance?.classType?active.getClass(instance.classType):null
                const method = classType?.getFunction(methodName) ?? null
                if(instance&&method){
                    this.methodPointerName = `__ds_method_callback_${++methodCallbackId}`
                    this.methodInstance = instance
                    this.methodName = methodName
                    this.methodClassType = classType?.name ?? null
                    this.methodParamCount = method.params.length
                    this.value = new FuncElement(this.methodPointerName, [])
                }
            }
            const member = text.match(/^([a-z_$][\w$]*(?:\.[a-z_$][\w$]*)+)(?:\[([^\]]+)\])?$/i)
            const access = member?getClassPropertyAccess(active,member[1]):null
            const instance = access?.instance??null
            const property = access?.property??null
            if(instance&&property&&member&&access){
                const propertyValue = new DataElement('let',`${instance.name}.${access.path}`,property.type??'',property.value??'')
                propertyValue.numericKind = property.numericKind
                propertyValue.isArray = property.isArray
                propertyValue.classType = property.classType
                this.value = propertyValue
                this.classPropertyInstance = instance
                this.classProperty = property
                this.classPropertyPath = access.path
                this.classPropertyOffsetPath = member[1].split('.').slice(1).join('.')
                if(instance.isParameter&&!property.isArray){
                    this.tempName = `__ds_call_arg_${++argumentId}`
                }
                if(property.isArray&&member[2]){
                    const arrayIndex = parseExpression(member[2],active)
                    if(arrayIndex.numericKind!=='integer'){
                        throw new Error('Array index must be an integer')
                    }
                    this.expression = {
                        kind:'index',
                        value:propertyValue,
                        index:arrayIndex,
                        numericKind:property.numericKind
                    }
                    this.tempName = `__ds_call_arg_${++argumentId}`
                }
            }
            const arrayMember = text.match(/^([a-z_$][\w.$]*)\[([^\]]+)\]\.(\w+)$/i)
            if(!this.tempName&&arrayMember){
                const [,arrayName,indexText,propertyName] = arrayMember
                const array = active.getData(arrayName)
                const arrayClassType = array?.classType?active.getClass(array.classType):null
                const property = arrayClassType?.props.find(prop=>prop.name===propertyName)??null
                if(array&&property&&arrayClassType){
                    const offset = getClassPropertyOffset(arrayClassType,propertyName,name=>active.getClass(name))
                    if(offset!==null){
                        this.arrayPropertyAccess = {
                            array,
                            indexExpression: parseExpression(indexText,active),
                            property,
                            offset
                        }
                        this.tempName = `__ds_call_arg_${++argumentId}`
                    }
                }
            }
            const arrayElement = text.match(/^([a-z_$][\w.$]*)\[([^\]]+)\]$/i)
            if(!this.tempName&&arrayElement){
                const array = active.getData(arrayElement[1])
                if(array?.isArray){
                    const indexExpression = parseExpression(arrayElement[2],active)
                    if(indexExpression.numericKind!=='integer'){
                        throw new Error('Array index must be an integer')
                    }
                    this.arrayElementAccess = {array,indexExpression}
                    const element = new DataElement('let',`${array.name}[${arrayElement[2]}]`,array.type??'',array.value??'')
                    element.classType = array.classType
                    element.numericKind = array.numericKind
                    this.value = element
                    this.tempName = `__ds_call_arg_${++argumentId}`
                }
            }
        }
        if(this.value instanceof DataElement&&this.value.isArray&&this.value.isParameter){
            this.arrayPointerName = `__ds_call_array_${++argumentId}`
        }
        if(this.value instanceof DataElement&&this.value.isParameter&&!this.value.isArray){
            this.tempName = `__ds_call_arg_${++argumentId}`
        }else if(!this.expression&&!this.arrayPropertyAccess&&!this.arrayElementAccess&&!/^['"]/.test(text)&&(/\*\*|[+\-*/%]/.test(text)||/\[[^\]]+\]/.test(text)||/^(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(text))){
            this.expression = parseExpression(text,active)
            this.tempName = `__ds_call_arg_${++argumentId}`
        }
    }

    asm(ASM:Asm){
        if(this.addressOf&&this.classPropertyInstance&&this.classProperty){
            if(this.classPropertyInstance.isHeapAllocated){
                const classType = this.classPropertyInstance.classType
                    ? this.scope.getClass(this.classPropertyInstance.classType)
                    : null
                const offset = classType
                    ? getClassPropertyOffset(classType,this.classPropertyOffsetPath??this.classProperty.name??'',name=>this.scope.getClass(name))
                    : null
                if(offset===null){
                    throw new Error(`Unable to resolve local struct property "${this.classPropertyOffsetPath??this.classProperty.name}"`)
                }
                this.tempName ??= `__ds_call_arg_${++argumentId}`
                ASM.addCode(`mov rdx, [${this.classPropertyInstance.name}]`)
                if(offset){
                    ASM.addCode(`add rdx, ${offset}`)
                }
                ASM.addData(`${this.tempName} dq 0`)
                ASM.addCode(`mov [${this.tempName}], rdx`)
                return
            }
            return
        }
        if(this.methodPointerName&&this.methodInstance&&this.methodName&&this.methodClassType){
            const methodLabel = `${this.methodClassType}.${this.methodName}`
            const callbackParams = Array.from(
                {length:Math.min(this.methodParamCount,3)},
                (_,index)=>`__ds_method_arg_${index+1}`
            )
            const body = [`proc ${this.methodPointerName}${callbackParams.length?`, ${callbackParams.join(', ')}`:''}`]
            for(let index=0;index<callbackParams.length;index++){
                body.push(`mov ${['rdx','r8','r9'][index]}, ${callbackParams[index]}`)
            }
            body.push(this.methodInstance.isHeapAllocated
                ? `mov rcx, [${this.methodInstance.name}]`
                : `lea rcx, [${this.methodInstance.name}]`)
            body.push('sub rsp, 32')
            body.push(`call ${methodLabel}`)
            body.push('add rsp, 32')
            body.push('ret')
            body.push('endp')
            ASM.addProc(body.join('\n'))
        }
        if(this.classPropertyInstance?.isProcedureLocal&&this.classProperty&&!this.classProperty.isArray&&this.value instanceof DataElement){
            const classType = this.classPropertyInstance.classType
                ? this.scope.getClass(this.classPropertyInstance.classType)
                : null
            const offset = classType
                ? getClassPropertyOffset(classType,this.classPropertyOffsetPath??this.classProperty.name??'',name=>this.scope.getClass(name))
                : null
            if(offset===null){
                throw new Error(`Unable to resolve local struct property "${this.classPropertyOffsetPath??this.classProperty.name}"`)
            }
            this.tempName ??= `__ds_call_arg_${++argumentId}`
            ASM.addCode(this.classPropertyInstance.isHeapAllocated
                ? `mov rdx, [${this.classPropertyInstance.name}]`
                : `lea rdx, [${this.classPropertyInstance.name}]`)
            if(offset){
                ASM.addCode(`add rdx, ${offset}`)
            }
            if(this.classProperty.type==='number'&&this.classProperty.numericKind==='float'){
                ASM.addCode('movsd xmm0, qword [rdx]')
                ASM.addData(`${this.tempName} dq 0`)
                ASM.addCode(`movsd qword [${this.tempName}], xmm0`)
            }else{
                ASM.addCode('mov rax, [rdx]')
                ASM.addData(`${this.tempName} dq 0`)
                ASM.addCode(`mov [${this.tempName}], rax`)
            }
            return
        }
        if(this.classPropertyInstance&&this.classProperty&&this.value instanceof DataElement){
            this.value.name = this.getClassPropertyAccessName()
        }
        if(this.classPropertyInstance?.isParameter&&this.classProperty&&!this.classProperty.isArray&&this.tempName){
            const classType = this.classPropertyInstance.classType
                ? this.scope.getClass(this.classPropertyInstance.classType)
                : null
            const offset = classType
                ? getClassPropertyOffset(classType,this.classPropertyOffsetPath??this.classProperty.name??'',name=>this.scope.getClass(name))
                : null
            if(offset===null){
                throw new Error(`Unable to resolve struct parameter property "${this.classProperty.name}"`)
            }
            ASM.addCode(`mov rdx, ${this.classPropertyInstance.name}`)
            ASM.addCode(`mov rax, [rdx+${offset}]`)
            ASM.addData(`${this.tempName} dq 0`)
            ASM.addCode(`mov [${this.tempName}], rax`)
            return
        }
        if(this.arrayPropertyAccess&&this.tempName){
            const {array,indexExpression,property,offset} = this.arrayPropertyAccess
            emitExpression(indexExpression,ASM)
            ASM.addCode('shl rax, 3')
            if(array.isParameter){
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
            if(offset){
                ASM.addCode(`add rax, ${offset}`)
            }
            ASM.addCode('mov rax, [rax]')
            ASM.addData(`${this.tempName} dq 0`)
            ASM.addCode(`mov [${this.tempName}], rax`)
            return
        }
        if(this.arrayElementAccess&&this.tempName){
            const {array,indexExpression} = this.arrayElementAccess
            emitExpression(indexExpression,ASM)
            ASM.addCode('shl rax, 3')
            if(array.isParameter){
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
            ASM.addData(`${this.tempName} dq 0`)
            ASM.addCode(`mov [${this.tempName}], rax`)
            return
        }
        if(this.arrayPointerName&&this.value instanceof DataElement){
            ASM.addData(`${this.arrayPointerName} dq 0`)
            ASM.addCode(this.value.dynamicArray
                ? `mov rax, [${this.value.name}]`
                : `mov rax, ${this.value.name}`)
            ASM.addCode(`mov [${this.arrayPointerName}], rax`)
        }
        if(this.tempName&&this.value instanceof DataElement&&this.value.isParameter&&!this.expression){
            ASM.addData(`${this.tempName} dq 0`)
            ASM.addCode(`mov rax, ${this.value.name}`)
            ASM.addCode(`mov [${this.tempName}], rax`)
            return
        }
        if(!this.expression||!this.tempName){
            return
        }
        emitExpression(this.expression,ASM)
        ASM.addData(`${this.tempName} dq 0`)
        ASM.addCode(this.expression.numericKind==='float'
            ? `movsd qword [${this.tempName}], xmm0`
            : `mov [${this.tempName}], rax`)
    }

    getCode(byValue=false){
        if(this.addressOf){
            if(this.classPropertyInstance&&this.classProperty){
                if(this.classPropertyInstance.isHeapAllocated&&this.tempName){
                    return `[${this.tempName}]`
                }
                return `addr [${this.getClassPropertyAccessName()}]`
            }
            return 'addr '+this.addressOf.name
        }
        if(this.arrayPointerName){
            return this.arrayPointerName
        }
        if(this.tempName){
            return byValue?`[${this.tempName}]`:this.tempName
        }
        if(this.classPropertyInstance&&this.classProperty){
            const name = this.getClassPropertyAccessName()
            if(this.classProperty.type==='string'){
                return `[${name}]`
            }
            if(this.classProperty.isArray){
                return 'addr '+name
            }
            if(byValue&&this.classProperty.type==='number'){
                return '['+name+']'
            }
            return name
        }
        if(this.value instanceof DataElement){
            return this.value.getCode(byValue)
        }
        if(this.value instanceof FuncElement){
            return `addr ${this.value.getCode()}`
        }
        return this.value
    }

    getClassPropertyAccessName(){
        const instance = this.classPropertyInstance
        const property = this.classProperty
        if(!instance||!property){
            throw new Error('Struct property access is not initialized')
        }
        const path = this.classPropertyPath??property.name??''
        if(instance.isProcedureLocal&&instance.classType){
            const classType = this.scope.getClass(instance.classType)
            const offset = classType
                ? getClassPropertyOffset(classType,this.classPropertyOffsetPath??property.name??'',name=>this.scope.getClass(name))
                : null
            if(offset===null){
                throw new Error(`Unable to resolve local struct property "${path}"`)
            }
            return `${instance.name}+${offset}`
        }
        return `${instance.name}.${path}`
    }
}

export default FunctionArgument
