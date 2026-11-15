import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from './../asm.ts'
import DataElement from './dataElement.ts'
import {emitExpression, parseExpression, type Expression} from '../maths.ts'
import {getClassPropertyAccess, getClassPropertyOffset} from './clasElement.ts'
import Invoke, {isInvoke} from './invoke.ts'
import FuncElement from './funcElement.ts'

let stringAssignId = 0
let callbackId = 0

export class Assign extends Base{
    target:DataElement|null = null
    expression:Expression|null = null
    targetIndex:Expression|null = null
    stringValue:string|null = null
    stringPropertyTarget = false
    stringSource:DataElement|null = null
    stringSourceIndex:Expression|null = null
    arrayPropertyTarget:{array:DataElement,index:Expression,property:DataElement,offset:number}|null = null
    addressLabel:string|null = null
    invokeExpression:Invoke|null = null
    addressFunction:FuncElement|null = null
    constructor(parent:Base){
        super(parent)
    }
    setExpression(target:DataElement,expression:string,initializer=false,indexText?:string){
        const isStringArray = target.isArray && (target.type==='string'||target.type==='string[]')
        if(!initializer&&target.kind==='const'){
            throw new Error(`Cannot assign to constant "${target.name}"`)
        }
        if(target.isArray&&!indexText){
            throw new Error(`Array "${target.name}" must be assigned through an index`)
        }
        if((target.type==='string'||target.type==='string[]')&&(!target.isArray||!indexText)){
            throw new Error('String assignment is only supported for string array elements')
        }
        if((target.type!=='number'&&!target.isArray)&&(target.type!=='string'&&target.type!=='string[]')){
            throw new Error('Assignment is only supported for number variables and string array elements')
        }
        this.target = target
        if(isStringArray){
            const value = expression.trim()
            const stringLiteral = value.match(/^(['"])(?:\\.|(?!\1).)*\1$/s)
            if(stringLiteral){
                this.stringValue = value
                if(indexText){
                    this.targetIndex = parseExpression(indexText,this.parent!)
                    if(this.targetIndex.numericKind!=='integer'){
                        throw new Error('Array index must be an integer')
                    }
                }
                return
            }
            const arrayMember = value.match(/^([a-z_$][\w.$]*)\[([^\]]+)\]$/i)
            if(arrayMember){
                const source = this.parent?.getData(arrayMember[1])
                if(source&&source.isArray&&(source.type==='string'||source.type==='string[]')){
                    this.stringSource = source
                    this.stringSourceIndex = parseExpression(arrayMember[2],this.parent!)
                    if(this.stringSourceIndex.numericKind!=='integer'){
                        throw new Error('Array index must be an integer')
                    }
                    if(indexText){
                        this.targetIndex = parseExpression(indexText,this.parent!)
                        if(this.targetIndex.numericKind!=='integer'){
                            throw new Error('Array index must be an integer')
                        }
                    }
                    return
                }
            }
            const source = this.parent?.getData(value)
            if(source&&source.type==='string'&&!source.isArray){
                this.stringSource = source
                if(indexText){
                    this.targetIndex = parseExpression(indexText,this.parent!)
                    if(this.targetIndex.numericKind!=='integer'){
                        throw new Error('Array index must be an integer')
                    }
                }
                return
            }
            throw new Error(`String array assignment requires a string literal, string variable, or string-array element: "${expression}"`)
        }
        const address = !indexText?expression.trim().match(/^&([a-z_$][\w.$]*)$/i):null
        if(address){
            this.addressLabel = address[1]
            this.addressFunction = this.parent?.getFunction(address[1])??null
            if(this.addressFunction&&!this.addressFunction.nativeCallbackName){
                this.addressFunction.nativeCallbackName = `__ds_native_callback_${++callbackId}`
            }
            return
        }
        const nativeCall = !indexText?expression.trim().match(/^([a-z_$][\w$]*)\(([\s\S]*)\)$/i):null
        if(nativeCall&&isInvoke(nativeCall[1])){
            this.invokeExpression = new Invoke(this.parent!)
            this.invokeExpression.set(new Tokenizer(expression.trim()))
            target.numericKind = 'integer'
            return
        }
        this.expression = parseExpression(expression,this.parent!)
        if(indexText){
            this.targetIndex = parseExpression(indexText,this.parent!)
            if(this.targetIndex.numericKind!=='integer'){
                throw new Error('Array index must be an integer')
            }
        }
        target.numericKind = target.numericKind==='float'||this.expression.numericKind==='float'
            ? 'float'
            : 'integer'
    }
    set(tokenizer:Tokenizer){
        const tokens:string[] = []
        let token:string
        while(!['\n',';'].includes(token = tokenizer.get())){
            tokens.push(token)
        }
        let statement = tokens.join('').replace(/;$/,'')
        const postfixUpdate = statement.match(/^([a-z_$][\w.$]*)(?:\[([^\]]+)\])?(\+\+|--)$/i)
        if(postfixUpdate){
            const [,targetName,indexText,operator] = postfixUpdate
            const target = `${targetName}${indexText?`[${indexText}]`:''}`
            statement = `${target}=${target}${operator==='++'?'+':'-'}1`
        }
        const arrayProperty = statement.match(/^([a-z_$][\w$]*)\[([^\]]+)\]\.(\w+)=(.+?);?$/i)
        if(arrayProperty){
            const [,arrayName,indexText,propertyName,expression] = arrayProperty
            const array = this.parent?.getData(arrayName)
            const classType = array?.classType?this.parent?.getClass(array.classType):null
            const property = classType?.props.find(prop=>prop.name===propertyName)??null
            const offset = classType?getClassPropertyOffset(classType,propertyName,name=>this.parent!.getClass(name)):null
            if(!array?.isArray||!classType||!property||offset===null){
                throw new Error(`Unknown object-array property "${arrayName}[${indexText}].${propertyName}"`)
            }
            if(property.type!=='number'){
                throw new Error('Only numeric object-array properties can be assigned')
            }
            const index = parseExpression(indexText,this.parent!)
            if(index.numericKind!=='integer'){
                throw new Error('Array index must be an integer')
            }
            this.target = array
            this.expression = parseExpression(expression,this.parent!)
            this.arrayPropertyTarget = {array,index,property,offset}
            return
        }
        const match = statement.match(/^([a-z_$][\w.$]*)(?:\[([^\]]+)\])?(\*\*=|\+=|-=|\*=|\/=|%=|=)(.+?);?$/i)
        if(!match){
            throw new Error('Invalid assignment')
        }
        const [,targetName,indexText,operator,expression] = match
        const access = this.parent?getClassPropertyAccess(this.parent,targetName):null
        const target = this.parent?.getData(targetName)??(access
            ? new DataElement('let',`${access.instance.name}.${access.path}`,access.property.type??'',access.property.value??'')
            : null)
        if(!target){
            throw new Error(`Unknown assignment target "${targetName}"`)
        }
        if(access){
            target.classType = access.property.classType
            target.isArray = access.property.isArray
            target.numericKind = access.property.numericKind
            target.classPropertyInstance = access.instance
            target.classPropertyPath = access.path
            if(access.instance.classType){
                const classType = this.parent?.getClass(access.instance.classType)
                target.classPropertyOffset = classType
                    ? getClassPropertyOffset(classType,access.path,name=>this.parent!.getClass(name))
                    : null
                if(target.classPropertyOffset===null){
                    throw new Error(`Unable to resolve local struct property "${access.path}"`)
                }
            }
        }
        if(operator!=='='&&target.type!=='number'){
            throw new Error('Compound assignment is only supported for number variables')
        }
        if(access?.property.type==='string'&&!access.property.isArray){
            const literal = expression.trim().match(/^(['"])(?:\\.|(?!\1).)*\1$/s)
            if(operator!=='='||!literal){
                throw new Error('Struct string properties can only be assigned a string literal')
            }
            this.target = target
            this.stringValue = literal[0]
            this.stringPropertyTarget = true
            return
        }
        const assignmentExpression = operator==='='
            ? expression
            : `${targetName}${indexText?`[${indexText}]`:''}${operator.slice(0,-1)}(${expression})`
        this.setExpression(target,assignmentExpression,false,indexText)
    }
    asm(ASM:Asm){
        if(!this.target){
            throw new Error('Assignment is not initialized')
        }
        const targetName = this.target.getAccessName()
        const storeTarget = (value:string,asFloat=false)=>{
            const instance = this.target?.classPropertyInstance
            const offset = this.target?.classPropertyOffset
            if(instance?.isProcedureLocal&&offset!==null&&offset!==undefined){
                ASM.addCode(`lea rdx, [${instance.name}]`)
                ASM.addCode(asFloat
                    ? `movsd qword [rdx+${offset}], ${value}`
                    : `mov [rdx+${offset}], ${value}`)
                return
            }
            ASM.addCode(asFloat
                ? `movsd qword [${targetName}], ${value}`
                : `mov [${targetName}], ${value}`)
        }
        if(this.stringPropertyTarget){
            const valueLabel = `__ds_str_assign_${++stringAssignId}`
            ASM.addData(`${valueLabel} db ${this.stringValue},0`)
            ASM.addCode(`lea rax, [${valueLabel}]`)
            storeTarget('rax')
            return
        }
        if(this.addressLabel){
            ASM.addCode(`lea rax, [${this.addressFunction?.nativeCallbackName??this.addressFunction?.name??this.addressLabel}]`)
            storeTarget('rax')
            return
        }
        if(this.invokeExpression){
            this.invokeExpression.asm(ASM)
            storeTarget('rax')
            return
        }
        if(this.arrayPropertyTarget&&this.expression){
            const {array,index,property,offset} = this.arrayPropertyTarget
            emitExpression(index,ASM)
            ASM.addCode('shl rax, 3')
            ASM.addCode(array.dynamicArray
                ? `mov rdx, [${array.name}]`
                : `lea rdx, [${array.name}]`)
            ASM.addCode('add rdx, rax')
            ASM.addCode('mov rdx, [rdx]')
            if(offset){
                ASM.addCode(`add rdx, ${offset}`)
            }
            ASM.addCode('push rdx')
            emitExpression(this.expression,ASM)
            ASM.addCode('pop rdx')
            if(this.expression.numericKind==='float'||property.numericKind==='float'){
                if(this.expression.numericKind==='integer'){
                    ASM.addCode('cvtsi2sd xmm0, rax')
                }
                ASM.addCode('movsd qword [rdx], xmm0')
            }else{
                ASM.addCode('mov [rdx], rax')
            }
            return
        }
        if(this.target.isArray && (this.target.type==='string'||this.target.type==='string[]')){
            if(this.targetIndex){
                emitExpression(this.targetIndex,ASM)
                ASM.addCode('shl rax, 3')
                if(this.target.isParameter){
                    ASM.addCode(`mov rdx, ${targetName}`)
                    if(this.target.dynamicArray){
                        ASM.addCode('mov rdx, [rdx]')
                    }
                }else if(this.target.dynamicArray){
                    ASM.addCode(`mov rdx, [${targetName}]`)
                }else{
                    ASM.addCode(`lea rdx, [${targetName}]`)
                }
                ASM.addCode('add rdx, rax')
                ASM.addCode('push rdx')
            }
            const valueLabel = this.stringValue
                ? `__ds_str_assign_${++stringAssignId}`
                : null
            if(this.stringValue){
                ASM.addData(`${valueLabel} db ${this.stringValue},0`)
                ASM.addCode(`lea rax, [${valueLabel}]`)
            }else if(this.stringSourceIndex&&this.stringSource){
                emitExpression(this.stringSourceIndex,ASM)
                ASM.addCode('shl rax, 3')
                if(this.stringSource.isParameter){
                    ASM.addCode(`mov rdx, ${this.stringSource.name}`)
                    if(this.stringSource.dynamicArray){
                        ASM.addCode('mov rdx, [rdx]')
                    }
                }else{
                    ASM.addCode(this.stringSource.dynamicArray
                        ? `mov rdx, [${this.stringSource.name}]`
                        : `lea rdx, [${this.stringSource.name}]`)
                }
                ASM.addCode('add rdx, rax')
                ASM.addCode('mov rax, [rdx]')
            }else if(this.stringSource){
                ASM.addCode(`lea rax, [${this.stringSource.name}]`)
            }
            if(this.targetIndex){
                ASM.addCode('pop rdx')
                ASM.addCode('mov [rdx], rax')
                return
            }
            throw new Error('String array assignment is not initialized')
        }
        if(!this.expression){
            throw new Error('Assignment is not initialized')
        }
        if(this.targetIndex){
            emitExpression(this.targetIndex,ASM)
            ASM.addCode('shl rax, 3')
            if(this.target!.isParameter){
                ASM.addCode(`mov rdx, ${targetName}`)
                if(this.target!.dynamicArray){
                    ASM.addCode('mov rdx, [rdx]')
                }
            }else if(this.target!.dynamicArray){
                ASM.addCode(`mov rdx, [${targetName}]`)
            }else{
                ASM.addCode(`lea rdx, [${targetName}]`)
            }
            ASM.addCode('add rdx, rax')
            ASM.addCode('push rdx')
        }
        emitExpression(this.expression,ASM)
        if(this.targetIndex){
            ASM.addCode('pop rdx')
            if(this.expression.numericKind==='float'||this.target.numericKind==='float'){
                if(this.expression.numericKind==='integer'){
                    ASM.addCode('cvtsi2sd xmm0, rax')
                }
                ASM.addCode('movsd qword [rdx], xmm0')
            }else{
                ASM.addCode('mov [rdx], rax')
            }
            return
        }
        if(this.expression.numericKind==='float'){
            storeTarget('xmm0',true)
        }else if(this.target.numericKind==='float'){
            ASM.addCode('cvtsi2sd xmm0, rax')
            storeTarget('xmm0',true)
        }else{
            storeTarget('rax')
        }
    }
    static test(active:Base,tokenizer:Tokenizer){
        const first = tokenizer.get()
        const second = tokenizer.get()
        tokenizer.move(-2)
        const compactAssignment = first.match(/^([a-z_$][\w.$]*(?:\[[^\]]+\])?)(?:\*\*=|\+=|-=|\*=|\/=|%=|=)/i)
        const postfixUpdate = first.match(/^([a-z_$][\w.$]*(?:\[[^\]]+\])?)(?:\+\+|--)$/i)
        const propertyAssignment = first.match(/^([a-z_$][\w$]*\[[^\]]+\]\.[a-z_$][\w$]*)(?:\*\*=|\+=|-=|\*=|\/=|%=|=)/i)
        const isAssignmentOperator = second==='='||['+=','-=','*=','/=','%=','**='].includes(second)
        const targetName = isAssignmentOperator?first:compactAssignment?.[1]??postfixUpdate?.[1]??propertyAssignment?.[1]
        const dataName = targetName?.match(/^([a-z_$][\w.$]*)/i)?.[1]
        if(dataName&&(active.getData(dataName)||getClassPropertyAccess(active,dataName))){
            const data = new Assign(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        return null
    }
}

export default Assign
