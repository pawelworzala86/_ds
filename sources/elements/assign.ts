import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from './../asm.ts'
import DataElement from './dataElement.ts'
import {emitExpression, isMathFunction, parseExpression, type Expression} from '../maths.ts'
import {getClassPropertyAccess, getClassPropertyOffset} from './clasElement.ts'
import Invoke, {isInvoke} from './invoke.ts'
import FuncElement from './funcElement.ts'
import Call from './call.ts'
import Timeout from './timeout.ts'
import {stringLiteralData} from '../stringLiteral.ts'

let stringAssignId = 0
let callbackId = 0

export class Assign extends Base{
    target:DataElement|null = null
    expression:Expression|null = null
    targetIndex:Expression|null = null
    stringValue:string|null = null
    stringAppend = false
    stringPropertyTarget = false
    stringSource:DataElement|null = null
    stringCall:Call|null = null
    stringSourceIndex:Expression|null = null
    arrayPropertyTarget:{array:DataElement,index:Expression,property:DataElement,offset:number}|null = null
    addressLabel:string|null = null
    invokeExpression:Invoke|null = null
    functionCall:Call|null = null
    arrayCall:Call|null = null
    asyncCall:Call|null = null
    timeout:Timeout|null = null
    addressFunction:FuncElement|null = null
    constructor(parent:Base){
        super(parent)
    }
    setExpression(target:DataElement,expression:string,initializer=false,indexText?:string,append=false){
        const isStringArray = target.isArray && (target.type==='string'||target.type==='string[]')
        if(!initializer&&target.kind==='const'){
            throw new Error(`Cannot assign to constant "${target.name}"`)
        }
        if(target.isArray&&!indexText){
            const callSyntax = expression.trim().match(/^[a-z_$][\w.$]*\([\s\S]*\)$/i)
            if(callSyntax){
                const tokenizer = new Tokenizer(expression.trim())
                const call = new Call(this.parent!)
                call.set(tokenizer)
                if(!tokenizer.has()
                    &&target.dynamicArray
                    &&!target.classPropertyInstance
                    &&call.func?.returnArrayType===`${target.type}[]`
                    &&!call.func.isAsync
                    &&!call.methodInstance
                    &&!call.prototypeMethod){
                    this.target = target
                    this.arrayCall = call
                    target.numericKind = call.func.returnArrayNumericKind
                    return
                }
            }
            throw new Error(`Array "${target.name}" must be assigned from a function returning "${target.type}[]"`)
        }
        if(target.type==='string'&&!target.isArray){
            if(indexText){
                throw new Error('String variables cannot be indexed')
            }
            this.target = target
            this.stringAppend = append
            const value = expression.trim()
            if(!append&&/^[a-z_$][\w.$]*\([\s\S]*\)$/i.test(value)){
                const tokenizer = new Tokenizer(value)
                const call = new Call(this.parent!)
                call.set(tokenizer)
                if(!tokenizer.has()&&call.builtinStringReplace){
                    this.stringCall = call
                    return
                }
            }
            const stringLiteral = value.match(/^(['"])(?:\\.|(?!\1).)*\1$/s)
            if(stringLiteral){
                this.stringValue = value
                return
            }
            const source = this.parent?.getData(value)
            if(source&&source.type==='string'&&!source.isArray){
                this.stringSource = source
                return
            }
            throw new Error(`String assignment requires a string literal or string variable: "${expression}"`)
        }
        if((target.type==='string'||target.type==='string[]')&&(!target.isArray||!indexText)){
            throw new Error('String assignment is only supported for string array elements')
        }
        if((target.type!=='number'&&target.type!=='Function'&&target.type!=='function'&&!target.isArray)&&(target.type!=='string'&&target.type!=='string[]')){
            throw new Error('Assignment is only supported for number and function variables and string array elements')
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
        const nativeCall = !indexText?expression.trim().match(/^([a-z_$][\w$]*(?:\.[a-z_$][\w$]*)*)\(([\s\S]*)\)$/i):null
        if(nativeCall&&isInvoke(nativeCall[1])&&!isMathFunction(nativeCall[1])){
            this.invokeExpression = new Invoke(this.parent!)
            this.invokeExpression.set(new Tokenizer(expression.trim()))
            target.numericKind = 'integer'
            return
        }
        if(nativeCall&&!isMathFunction(nativeCall[1])){
            const call = new Call(this.parent!)
            const tokenizer = new Tokenizer(expression.trim())
            call.set(tokenizer)
            if(!tokenizer.has()&&(call.func||call.functionVariable)&&!call.func?.isAsync&&!call.prototypeMethod){
                this.functionCall = call
                target.numericKind = 'integer'
                return
            }
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
    setTask(target:DataElement,expression:string){
        const tokenizer = new Tokenizer(expression)
        if(tokenizer.tokens[0]==='setTimeout'){
            const timeout = new Timeout(this.parent!)
            timeout.set(tokenizer)
            if(tokenizer.has()){
                throw new Error('Task initializer must be a single setTimeout call')
            }
            this.target = target
            this.timeout = timeout
            return
        }
        const call = new Call(this.parent!)
        call.set(tokenizer)
        if(tokenizer.has()){
            throw new Error('Task initializer must be a single async function call')
        }
        if(!call.func?.isAsync){
            throw new Error('Task initializer must call an async function')
        }
        this.target = target
        this.asyncCall = call
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
                    ? getClassPropertyOffset(classType,targetName.split('.').slice(1).join('.'),name=>this.parent!.getClass(name))
                    : null
                if(target.classPropertyOffset===null){
                    throw new Error(`Unable to resolve local struct property "${access.path}"`)
                }
            }
        }
        const stringAppend = target.type==='string'&&operator==='+='
        if(operator!=='='&&target.type!=='number'&&!stringAppend){
            throw new Error('Compound assignment is only supported for number variables')
        }
        if(target.type==='Task'&&operator==='='){
            if(target.kind==='const'){
                throw new Error(`Cannot assign to constant "${target.name}"`)
            }
            this.setTask(target,expression)
            return
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
        this.setExpression(target,stringAppend?expression:assignmentExpression,false,indexText,stringAppend)
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
                ASM.addCode(instance.isHeapAllocated
                    ? `mov rdx, [${instance.name}]`
                    : `lea rdx, [${instance.name}]`)
                ASM.addCode(asFloat
                    ? `movsd qword [rdx+${offset}], ${value}`
                    : `mov [rdx+${offset}], ${value}`)
                return
            }
            ASM.addCode(asFloat
                ? `movsd qword [${targetName}], ${value}`
                : `mov [${targetName}], ${value}`)
        }
        if(this.asyncCall){
            const target = this.target
            if(!target.name){
                throw new Error('Task assignment target is not initialized')
            }
            this.asyncCall.asm(ASM,'handle')
            ASM.addCode(`mov [${target.getAccessName()}], rax`)
            return
        }
        if(this.timeout){
            const target = this.target
            if(!target.name){
                throw new Error('Task assignment target is not initialized')
            }
            this.timeout.asm(ASM,'handle')
            ASM.addCode(`mov [${target.getAccessName()}], rax`)
            return
        }
        if(this.stringPropertyTarget){
            const valueLabel = `__ds_str_assign_${++stringAssignId}`
            ASM.addData(`${valueLabel} ${stringLiteralData(this.stringValue!)}`)
            ASM.addCode(`lea rax, [${valueLabel}]`)
            storeTarget('rax')
            return
        }
        if(this.target.type==='string'&&!this.target.isArray){
            if(!this.stringAppend){
                if(this.stringCall){
                    this.stringCall.asm(ASM)
                    storeTarget('rax')
                    return
                }
                if(this.stringValue){
                    const valueLabel = `__ds_str_assign_${++stringAssignId}`
                    ASM.addData(`${valueLabel} ${stringLiteralData(this.stringValue)}`)
                    ASM.addCode(`lea rax, [${valueLabel}]`)
                }else if(this.stringSource){
                    ASM.addCode(this.stringSource.isParameter
                        ? `mov rax, ${this.stringSource.name}`
                        : `mov rax, [${this.stringSource.name}]`)
                }else{
                    throw new Error('String assignment is not initialized')
                }
                storeTarget('rax')
                return
            }
            const id = ++stringAssignId
            const destinationLabel = `__ds_str_append_destination_${id}`
            const sourceLabel = `__ds_str_append_source_${id}`
            const lengthLabel = `__ds_str_append_length_${id}`
            const bufferLabel = `__ds_str_append_buffer_${id}`
            const allocationError = `__ds_str_append_error_${id}`
            const allocationReady = `__ds_str_append_ready_${id}`
            if(this.stringValue){
                const valueLabel = `__ds_str_assign_${id}`
                ASM.addData(`${valueLabel} ${stringLiteralData(this.stringValue)}`)
                ASM.addCode(`lea rax, [${valueLabel}]`)
            }else if(this.stringSource){
                ASM.addCode(this.stringSource.isParameter
                    ? `mov rax, ${this.stringSource.name}`
                    : `mov rax, [${this.stringSource.name}]`)
            }else{
                throw new Error('String append source is not initialized')
            }
            ASM.addData(`${destinationLabel} dq 0`)
            ASM.addData(`${sourceLabel} dq 0`)
            ASM.addData(`${lengthLabel} dq 0`)
            ASM.addData(`${bufferLabel} dq 0`)
            ASM.addCode(`mov [${sourceLabel}], rax`)
            ASM.addCode(this.target.isParameter
                ? `mov rax, ${targetName}`
                : `mov rax, [${targetName}]`)
            ASM.addCode(`mov [${destinationLabel}], rax`)
            ASM.addImport('msvcrt','strlen')
            ASM.addImport('msvcrt','malloc')
            ASM.addImport('msvcrt','strcpy')
            ASM.addImport('msvcrt','strcat')
            ASM.addCode(`mov rcx, [${destinationLabel}]`)
            ASM.addCode('sub rsp, 40')
            ASM.addCode('call [strlen]')
            ASM.addCode('add rsp, 40')
            ASM.addCode(`mov [${lengthLabel}], rax`)
            ASM.addCode(`mov rcx, [${sourceLabel}]`)
            ASM.addCode('sub rsp, 40')
            ASM.addCode('call [strlen]')
            ASM.addCode('add rsp, 40')
            ASM.addCode(`add rax, [${lengthLabel}]`)
            ASM.addCode('inc rax')
            ASM.addCode('mov rcx, rax')
            ASM.addCode('sub rsp, 40')
            ASM.addCode('call [malloc]')
            ASM.addCode('add rsp, 40')
            ASM.addCode(`mov [${bufferLabel}], rax`)
            ASM.addCode('test rax, rax')
            ASM.addCode(`jz ${allocationError}`)
            ASM.addCode(`mov rcx, [${bufferLabel}]`)
            ASM.addCode(`mov rdx, [${destinationLabel}]`)
            ASM.addCode('sub rsp, 40')
            ASM.addCode('call [strcpy]')
            ASM.addCode('add rsp, 40')
            ASM.addCode(`mov rcx, [${bufferLabel}]`)
            ASM.addCode(`mov rdx, [${sourceLabel}]`)
            ASM.addCode('sub rsp, 40')
            ASM.addCode('call [strcat]')
            ASM.addCode('add rsp, 40')
            ASM.addCode(`mov rax, [${bufferLabel}]`)
            storeTarget('rax')
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
        if(this.functionCall){
            this.functionCall.asm(ASM)
            storeTarget('rax')
            return
        }
        if(this.arrayCall){
            this.arrayCall.asm(ASM)
            ASM.addCode('mov rdx, rax')
            ASM.addCode('mov rax, [rdx]')
            ASM.addCode(`mov [${targetName}], rax`)
            ASM.addCode('mov rax, [rdx+8]')
            ASM.addCode(`mov [${targetName}__length], rax`)
            ASM.addCode('mov rax, [rdx+16]')
            ASM.addCode(`mov [${targetName}__capacity], rax`)
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
                ASM.addData(`${valueLabel} ${stringLiteralData(this.stringValue)}`)
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
