import Asm from '../asm.ts'
import Base from './base.ts'
import {parseExpression, type Expression} from '../maths.ts'
import DataElement, {type JsonValue} from './dataElement.ts'
import FuncElement from './funcElement.ts'
import Link from './link.ts'
import {getClassPropertyAccess, getClassPropertyOffset} from './clasElement.ts'
import {emitFunctionArgument} from './functionArgument/emit.ts'
import {nextFunctionArgumentId} from './functionArgument/ids.ts'
import {parseRegExpLiteral} from '../regex.ts'

let methodCallbackId = 0

function splitStringConcatenation(text:string):string[]|null{
    const parts:string[] = []
    let start = 0
    let depth = 0
    let quote = ''
    let escaped = false
    for(let index=0;index<text.length;index++){
        const char = text[index]
        if(quote){
            if(escaped){
                escaped = false
            }else if(char==='\\'){
                escaped = true
            }else if(char===quote){
                quote = ''
            }
            continue
        }
        if(char==='"'||char==="'"){
            quote = char
        }else if(char==='('||char==='['){
            depth++
        }else if(char===')'||char===']'){
            depth--
        }else if(char==='+'&&depth===0){
            parts.push(text.slice(start,index).trim())
            start = index+1
        }
    }
    if(!parts.length){
        return null
    }
    parts.push(text.slice(start).trim())
    return parts
}

function getStringConcatenationParts(active:Base,text:string):(DataElement|string)[]|null{
    const parts = splitStringConcatenation(text)
    if(!parts){
        return null
    }
    const values:(DataElement|string)[] = []
    let containsString = false
    for(const part of parts){
        if(/^(['"])(?:\\.|(?!\1).)*\1$/s.test(part)){
            values.push(part)
            containsString = true
            continue
        }
        if(!/^[a-z_$][\w.$]*$/i.test(part)){
            return null
        }
        const access = getClassPropertyAccess(active,part)
        const value = active.getData(part)
            ??(access
                ? new DataElement('let',`${access.instance.name}.${access.path}`,access.property.type??'',access.property.value??'')
                : null)
        if(!value||value.isArray||value.type!=='string'){
            return null
        }
        values.push(value)
        containsString = true
    }
    return containsString?values:null
}

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
    jsonValue:JsonValue|undefined
    stringConcatenation:(DataElement|string)[]|null = null

    constructor(active:Base,text:string){
        this.scope = active
        this.value = Link.data(active,text)
        this.stringConcatenation = getStringConcatenationParts(active,text)
        if(this.stringConcatenation){
            this.tempName = `__ds_call_arg_${nextFunctionArgumentId()}`
            this.value = new DataElement('let',this.tempName,'string','0')
            return
        }
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
                    this.tempName = `__ds_call_arg_${nextFunctionArgumentId()}`
                }
                if(property.isArray&&member[2]){
                    const arrayIndex = parseExpression(member[2],active)
                    if(arrayIndex.numericKind!=='integer'){
                        throw new Error('Array index must be an integer')
                    }
                    const staticIndex = arrayIndex.kind==='number'
                        ? Number(arrayIndex.value)
                        : arrayIndex.kind==='data'&&arrayIndex.value.isConstAlias
                            ? Number(arrayIndex.value.value)
                            : null
                    if(Array.isArray(property.jsonValue)&&staticIndex!==null){
                        this.jsonValue = property.jsonValue[staticIndex]
                    }
                    this.expression = {
                        kind:'index',
                        value:propertyValue,
                        index:arrayIndex,
                        numericKind:property.numericKind
                    }
                    this.tempName = `__ds_call_arg_${nextFunctionArgumentId()}`
                }
            }
            const arrayMember = text.match(/^([a-z_$][\w.$]*)\[([^\]]+)\]\.(\w+)$/i)
            if(!this.tempName&&arrayMember){
                const [,arrayName,indexText,propertyName] = arrayMember
                const array = active.getData(arrayName)
                const indexExpression = parseExpression(indexText,active)
                if(indexExpression.numericKind!=='integer'){
                    throw new Error('Array index must be an integer')
                }
                const staticIndex = indexExpression.kind==='number'
                    ? Number(indexExpression.value)
                    : indexExpression.kind==='data'&&indexExpression.value.isConstAlias
                        ? Number(indexExpression.value.value)
                        : null
                const elementType = staticIndex===null?null:array?.arrayElementTypes.get(staticIndex)
                const className = elementType?.classType??array?.classType
                const arrayClassType = className?active.getClass(className):null
                const property = arrayClassType?.props.find(prop=>prop.name===propertyName)??null
                if(array&&property&&arrayClassType){
                    const offset = getClassPropertyOffset(arrayClassType,propertyName,name=>active.getClass(name))
                    if(offset!==null){
                        const propertyValue = new DataElement(
                            'let',
                            `${arrayName}[${indexText}].${propertyName}`,
                            property.type??'',
                            property.value??''
                        )
                        propertyValue.numericKind = property.numericKind
                        propertyValue.classType = property.classType
                        this.value = propertyValue
                        this.classProperty = property
                        this.classPropertyPath = propertyName
                        this.arrayPropertyAccess = {
                            array,
                            indexExpression,
                            property,
                            offset
                        }
                        this.tempName = `__ds_call_arg_${nextFunctionArgumentId()}`
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
                    const staticIndex = indexExpression.kind==='number'
                        ? Number(indexExpression.value)
                        : indexExpression.kind==='data'&&indexExpression.value.isConstAlias
                            ? Number(indexExpression.value.value)
                            : null
                    if(Array.isArray(array.jsonValue)&&staticIndex!==null){
                        this.jsonValue = array.jsonValue[staticIndex]
                    }
                    this.arrayElementAccess = {array,indexExpression}
                    const elementInfo = staticIndex===null?null:array.arrayElementTypes.get(staticIndex)
                    const element = new DataElement(
                        'let',
                        `${array.name}[${arrayElement[2]}]`,
                        elementInfo?.type??array.type??'',
                        array.value??''
                    )
                    element.classType = elementInfo?.classType??array.classType
                    element.numericKind = elementInfo?.numericKind??array.numericKind
                    element.typedArrayKind = array.typedArrayKind
                    this.value = element
                    this.tempName = `__ds_call_arg_${nextFunctionArgumentId()}`
                }
            }
        }
        if(this.value instanceof DataElement&&this.value.isArray&&this.value.isParameter){
            this.arrayPointerName = `__ds_call_array_${nextFunctionArgumentId()}`
        }
        if(this.value instanceof DataElement&&this.value.isParameter&&!this.value.isArray){
            this.tempName = `__ds_call_arg_${nextFunctionArgumentId()}`
        }else if(!this.expression&&!this.arrayPropertyAccess&&!this.arrayElementAccess&&!parseRegExpLiteral(text)&&!/^['"]/.test(text)&&(/\*\*|[+\-*/%]/.test(text)||/\[[^\]]+\]/.test(text)||/\.length$/i.test(text)||/^(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(text))){
            this.expression = parseExpression(text,active)
            this.tempName = `__ds_call_arg_${nextFunctionArgumentId()}`
        }
    }

    asm(ASM:Asm){
        emitFunctionArgument(this,ASM)
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
            if(byValue&&(this.classProperty.type==='number'||this.classProperty.type==='boolean')){
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
        if((instance.isProcedureLocal||instance.isReferenceAlias)&&instance.classType){
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
