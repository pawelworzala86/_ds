import Asm from '../asm.ts'
import Base from './base.ts'
import {emitExpression, parseExpression, type Expression} from '../maths.ts'
import DataElement from './dataElement.ts'
import FuncElement from './funcElement.ts'
import Link from './link.ts'
import {getClassPropertyOffset} from './clasElement.ts'

let argumentId = 0
let methodCallbackId = 0

export class FunctionArgument{
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
    arrayPropertyAccess:{array:DataElement,indexExpression:Expression,property:DataElement,offset:number}|null = null
    arrayElementAccess:{array:DataElement,indexExpression:Expression}|null = null

    constructor(active:Base,text:string){
        this.value = Link.data(active,text)
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
            const member = text.match(/^([a-z_$][\w.$]*)\.([a-z_$][\w$]*)(?:\[([^\]]+)\])?$/i)
            const instance = member?active.getData(member[1]):null
            const classType = instance?.classType?active.getClass(instance.classType):null
            const property = member?classType?.props.find(prop=>prop.name===member[2])??null:null
            if(instance&&property&&member){
                const propertyValue = new DataElement('let',`${instance.name}.${property.name}`,property.type??'',property.value??'')
                propertyValue.numericKind = property.numericKind
                propertyValue.isArray = property.isArray
                this.value = propertyValue
                this.classPropertyInstance = instance
                this.classProperty = property
                if(property.isArray&&member[3]){
                    const arrayIndex = parseExpression(member[3],active)
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
                    const offset = getClassPropertyOffset(arrayClassType,propertyName)
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
        if(this.methodPointerName&&this.methodInstance&&this.methodName&&this.methodClassType){
            const methodLabel = `${this.methodClassType}.${this.methodName}`
            const body = [`proc ${this.methodPointerName}`]
            body.push(`lea rcx, [${this.methodInstance.name}]`)
            for(let index=0;index<Math.min(this.methodParamCount,3);index++){
                const stackOffset = 56 + index * 8
                body.push(`mov ${['rdx','r8','r9'][index]}, [rbp+${stackOffset}]`)
            }
            body.push(`call ${methodLabel}`)
            body.push('ret')
            body.push('endp')
            ASM.addProc(body.join('\n'))
        }
        if(this.classPropertyInstance&&this.classProperty&&this.value instanceof DataElement){
            this.value.name = `${this.classPropertyInstance.name}.${this.classProperty.name}`
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
            if(property.type!=='string'){
                ASM.addCode('mov rax, [rax]')
            }
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
        if(this.arrayPointerName){
            return this.arrayPointerName
        }
        if(this.tempName){
            return byValue?`[${this.tempName}]`:this.tempName
        }
        if(this.classPropertyInstance&&this.classProperty){
            const name = `${this.classPropertyInstance.name}.${this.classProperty.name}`
            if(this.classProperty.type==='string'){
                return 'addr '+name
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
}

export default FunctionArgument
