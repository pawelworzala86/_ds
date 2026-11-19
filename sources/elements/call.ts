import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import FuncElement from './funcElement.ts'
import DataElement from './dataElement.ts'
import FunctionArgument from './functionArgument.ts'
import TypePrototypeRegistry, {type PrototypeMethod} from './typePrototype.ts'

let arrayPushId = 0
let asyncCallId = 0
let superStringId = 0

export class Call extends Base{
    func:FuncElement|null = null
    params:FunctionArgument[] = []
    methodInstance:DataElement|null = null
    builtinArray:DataElement|null = null
    functionVariable:DataElement|null = null
    prototypeMethod = false
    prototypeReceiver = false
    arrayPushId:number|null = null
    noOp = false
    superCall = false
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        const name = tokenizer.get()
        if(tokenizer.get()!=='('){
            throw new Error(`Expected '(' after function "${name}"`)
        }
        const superCall = name==='super'||name.startsWith('super.')
        this.superCall = superCall
        let superInstance:DataElement|null = null
        if(superCall){
            const parentClass = this.classElement?.parentClass
            if(!parentClass){
                throw new Error('Cannot call super without a parent class')
            }
            const methodName = name==='super'?'constructor':name.slice('super.'.length)
            this.func = parentClass.getFunction(methodName)
            if(!this.func){
                if(methodName!=='constructor'){
                    throw new Error(`Unknown parent method "${methodName}"`)
                }
                this.noOp = true
            }else{
                superInstance = new DataElement('let','this',parentClass.name??'','0')
                superInstance.classType = parentClass.name
                superInstance.isProcedureLocal = true
                this.methodInstance = superInstance
            }
        }
        const method = Call.getMethod(this,name)
        const prototype = Call.getPrototypeMethod(this,name)
        const variable = this.getData(name)
        this.func ??= method?.func??(prototype?.method.kind==='function'?prototype.method.func:null)??this.getFunction(name)
        this.methodInstance ??= method?.instance??null
        this.functionVariable = variable && (variable.type==='Function'||variable.type==='function') ? variable : null
        this.prototypeMethod = prototype?.method.kind==='function'
        this.prototypeReceiver = this.prototypeMethod&&Boolean(prototype&&!prototype.type.startsWith('class:'))
        this.builtinArray = prototype?.method.kind==='builtin'&&prototype.method.name==='push'
            ? prototype.instance
            : null
        this.params = tokenizer.getCallArguments().map(token=>new FunctionArgument(this,token))
        if(this.noOp&&this.params.length){
            throw new Error('Parent constructor does not accept arguments')
        }
        if(this.prototypeReceiver&&prototype){
            this.params.unshift(new FunctionArgument(this,prototype.instance.name??''))
        }
        if(this.builtinArray){
            this.builtinArray.dynamicArray = true
            if(this.params.length!==1){
                throw new Error('Array.push expects exactly one argument')
            }
            this.validateArrayPush(this.builtinArray,this.params[0])
            this.arrayPushId = ++arrayPushId
        }
        this.prepareDynamicArrayArguments()
    }
    prepareDynamicArrayArguments(){
        if(!this.func){
            return
        }
        this.func.params.forEach((parameter,index)=>{
            if(!parameter.dynamicArray){
                return
            }
            const argument = this.params[index]
            if(!(argument?.value instanceof DataElement)||!argument.value.isArray){
                throw new Error(`Function "${this.func!.name}" requires a dynamic array for parameter "${parameter.name}"`)
            }
            if(argument.value.isParameter&&!argument.value.dynamicArray){
                throw new Error(`Cannot pass static array parameter "${argument.value.name}" as a dynamic array`)
            }
            argument.value.dynamicArray = true
        })
    }
    prepareFunctionCalls(){
        super.prepareFunctionCalls()
        this.prepareDynamicArrayArguments()
    }
    asm(ASM:Asm,asyncMode:'detached'|'handle'|'await'='detached'){
        if(this.noOp){
            return
        }
        for(const param of this.params){
            param.asm(ASM)
        }
        if(this.superCall){
            this.emitSuperCall(ASM)
            return
        }
        if(this.func?.isAsync){
            this.emitAsyncCall(ASM,asyncMode)
            return
        }
        if(asyncMode!=='detached'){
            throw new Error('Only async functions can produce or await a Task')
        }
        if(this.builtinArray){
            this.emitArrayPush(ASM)
            return
        }
        if(this.functionVariable){
            const params = this.params.map(param=>{
                const value = param.getCode()
                if(value===null){
                    throw new Error('Unable to resolve function pointer argument')
                }
                if(value.startsWith('&')){
                    throw new Error(`Unable to resolve address argument "${value}"`)
                }
                if(value.startsWith("'")&&value.endsWith("'")){
                    return `addr ${value}`
                }
                if(param.value instanceof DataElement&&param.value.isConstAlias){
                    return value
                }
                if(param.value instanceof DataElement&&param.value.type==='Function'){
                    return `[${param.value.name}]`
                }else if(param.value instanceof DataElement&&param.value.isArray){
                    if(param.value.dynamicArray){
                        return `[${param.value.name}]`
                    }
                    return `addr ${param.value.name}`
                }
                if(param.arrayPointerName){
                    return `[${param.arrayPointerName}]`
                }
                if(param.tempName){
                    return `[${param.tempName}]`
                }
                if(value.startsWith('addr ')){
                    return value
                }
                return value.startsWith('[')&&value.endsWith(']')?value:`[${value}]`
            }).join(', ')
            ASM.addCode(`invoke [${this.functionVariable.name}] ${params}`)
            return
        }
        const canEmitArguments = this.params.every(param=>
            param.value instanceof DataElement||param.tempName!==null||param.arrayPointerName!==null
        )
        if(canEmitArguments&&!this.methodInstance){
            for(let index=0;index<this.params.length;index++){
                const param = this.params[index]
                const expected = this.func?.params[index]
                if(expected?.dynamicArray&&param.value instanceof DataElement&&param.value.isArray){
                    ASM.addCode(param.value.isParameter
                        ? `mov rax, ${param.value.name}`
                        : `lea rax, [${param.value.name}]`)
                }else if(param.value instanceof DataElement&&param.value.isConstAlias){
                    ASM.addCode(`mov rax, ${param.value.name}`)
                }else if(param.value instanceof DataElement&&param.value.isArray&&!param.arrayPointerName){
                    if(param.value.dynamicArray){
                        ASM.addCode(`mov rax, [${param.value.name}]`)
                    }else{
                        ASM.addCode(`lea rax, [${param.value.name}]`)
                    }
                }else if(param.arrayPointerName){
                    ASM.addCode(`mov rax, [${param.arrayPointerName}]`)
                }else if(param.tempName){
                    ASM.addCode(`mov rax, [${param.tempName}]`)
                }else if(param.classPropertyInstance&&param.classProperty?.type==='string'){
                    const name = param.getClassPropertyAccessName()
                    ASM.addCode(`mov rax, [${name}]`)
                }else if(param.value instanceof DataElement&&param.value.classType&&expected?.type===param.value.classType){
                    ASM.addCode(`lea rax, [${param.value.name}]`)
                }else{
                    const value = param.getCode()
                    if(value===null){
                        throw new Error('Unable to resolve function argument')
                    }
                    ASM.addCode(value.startsWith('addr ')
                        ? `lea rax, [${value.replace(/^addr\s+/,'')}]`
                        : `mov rax, [${value}]`)
                }
                ASM.addCode('push rax')
            }
            const shadowSpace = 32+(this.params.length%2===0?8:0)
            ASM.addCode(`sub rsp, ${shadowSpace}`)
            ASM.addCode(`call ${this.func!.name}`)
            ASM.addCode(`add rsp, ${shadowSpace+this.params.length*8}`)
            return
        }
        const params = this.params.map((param,index)=>{
            if(this.func?.params[index]?.dynamicArray&&param.value instanceof DataElement&&param.value.isArray){
                return param.value.isParameter?param.value.name:`addr ${param.value.name}`
            }
            return param.getCode(this.methodInstance!==null)
        }).join(', ')
        const methodName = this.methodInstance?.isProcedureLocal
            ? `${this.methodInstance.classType}.${this.func!.name}`
            : `${this.methodInstance?.name}.${this.func!.name}`
        const methodParams = this.methodInstance?.isProcedureLocal
            ? `addr ${this.methodInstance.name}${params?`, ${params}`:''}`
            : params
        const code = this.methodInstance
            ? `invoke ${methodName} ${methodParams}`
            : `rvcall ${this.func!.name} ${params}`
        ASM.addCode(code)
    }
    emitSuperCall(ASM:Asm){
        if(!this.func?.name){
            throw new Error('Parent method is not initialized')
        }
        if(this.params.length!==this.func.params.length){
            throw new Error(`Parent method "${this.func.name}" expects ${this.func.params.length} arguments, received ${this.params.length}`)
        }
        const registers = ['rdx','r8','r9']
        const totalArguments = this.params.length+1
        const stackBytes = 32+Math.max(0,totalArguments-4)*8
        const stackSize = stackBytes+(stackBytes%16===0?8:0)
        ASM.addCode(`sub rsp, ${stackSize}`)
        ASM.addCode('mov rcx, rsi')
        this.params.forEach((param,index)=>{
            const expected = this.func!.params[index]
            const value = expected?.dynamicArray&&param.value instanceof DataElement&&param.value.isArray
                ? param.value.isParameter?param.value.name:`addr ${param.value.name}`
                : param.getCode(true)
            if(value===null){
                throw new Error(`Unable to resolve parent method argument ${index+1}`)
            }
            const literal = value.match(/^(['"])([\s\S]*)\1$/)
            const argument = literal
                ? `addr __ds_super_string_${++superStringId}`
                : value
            if(literal){
                const contents = literal[2].replace(/'/g,"''")
                ASM.addData(`__ds_super_string_${superStringId} db '${contents}',0`)
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
        ASM.addCode(`call ${this.methodInstance?.classType}.${this.func.name}`)
        ASM.addCode(`add rsp, ${stackSize}`)
    }
    emitAsyncCall(ASM:Asm,mode:'detached'|'handle'|'await'='detached'){
        const func = this.func
        if(!func?.isAsync||!func.asyncWorkerName){
            throw new Error('Async call target is not an async function')
        }
        if(this.methodInstance||this.prototypeMethod){
            throw new Error('Async class and prototype methods are not supported')
        }
        if(this.params.length!==func.params.length){
            throw new Error(`Async function "${func.name}" expects ${func.params.length} arguments, received ${this.params.length}`)
        }
        const id = ++asyncCallId
        const allocationFailure = `__ds_async_alloc_failure_${id}`
        const createFailure = `__ds_async_create_failure_${id}`
        const waitFailure = `__ds_async_wait_failure_${id}`
        const done = `__ds_async_call_done_${id}`
        const hasParams = this.params.length>0

        ASM.addImport('kernel32','CreateThread')
        ASM.addImport('kernel32','CloseHandle')
        ASM.addImport('kernel32','ExitProcess')
        ASM.addCode('push rbx')
        if(hasParams){
            ASM.addImport('msvcrt','malloc')
            ASM.addCode(`mov rcx, ${this.params.length*8}`)
            ASM.addCode('sub rsp, 32')
            ASM.addCode('call [malloc]')
            ASM.addCode('add rsp, 32')
            ASM.addCode('test rax, rax')
            ASM.addCode(`jz ${allocationFailure}`)
            ASM.addCode('mov rbx, rax')
            this.params.forEach((param,index)=>{
                this.emitAsyncArgument(ASM,param,func.params[index],index)
                ASM.addCode(`mov [rbx+${index*8}], rax`)
            })
        }

        ASM.addCode('xor ecx, ecx')
        ASM.addCode('xor edx, edx')
        ASM.addCode(`lea r8, [${func.asyncWorkerName}]`)
        ASM.addCode(hasParams?'mov r9, rbx':'xor r9d, r9d')
        ASM.addCode('sub rsp, 48')
        ASM.addCode('mov qword [rsp+32], 0')
        ASM.addCode('mov qword [rsp+40], 0')
        ASM.addCode('call [CreateThread]')
        ASM.addCode('add rsp, 48')
        ASM.addCode('test rax, rax')
        ASM.addCode(`jz ${createFailure}`)

        if(mode==='handle'){
            ASM.addCode('pop rbx')
            ASM.addCode(`jmp ${done}`)
        }else if(mode==='await'){
            ASM.addImport('kernel32','WaitForSingleObject')
            ASM.addCode('mov rbx, rax')
            ASM.addCode('mov rcx, rbx')
            ASM.addCode('mov edx, 0xffffffff')
            ASM.addCode('sub rsp, 32')
            ASM.addCode('call [WaitForSingleObject]')
            ASM.addCode('add rsp, 32')
            ASM.addCode('test eax, eax')
            ASM.addCode(`jnz ${waitFailure}`)
        }else{
            ASM.addCode('mov rcx, rax')
        }
        if(mode!=='handle'){
            ASM.addCode('sub rsp, 32')
            ASM.addCode('call [CloseHandle]')
            ASM.addCode('add rsp, 32')
            ASM.addCode('pop rbx')
            ASM.addCode(`jmp ${done}`)
        }

        ASM.addCode(`${allocationFailure}:`)
        this.emitAsyncFailure(ASM)
        ASM.addCode(`jmp ${done}`)
        ASM.addCode(`${createFailure}:`)
        if(hasParams){
            ASM.addImport('msvcrt','free')
            ASM.addCode('mov rcx, rbx')
            ASM.addCode('sub rsp, 32')
            ASM.addCode('call [free]')
            ASM.addCode('add rsp, 32')
        }
        this.emitAsyncFailure(ASM)
        ASM.addCode(`jmp ${done}`)
        if(mode==='await'){
            ASM.addCode(`${waitFailure}:`)
            this.emitAsyncFailure(ASM)
            ASM.addCode(`jmp ${done}`)
        }
        ASM.addCode(`${done}:`)
    }
    emitAsyncArgument(ASM:Asm,param:FunctionArgument,expected:{name:string,type:string,dynamicArray?:boolean},index:number){
        if(param.tempName){
            ASM.addCode(`mov rax, [${param.tempName}]`)
            return
        }
        if(param.arrayPointerName){
            ASM.addCode(`mov rax, [${param.arrayPointerName}]`)
            return
        }
        if(param.value instanceof DataElement){
            const value = param.value
            if(value.isArray){
                if(expected.dynamicArray){
                    ASM.addCode(value.isParameter
                        ? `mov rax, ${value.name}`
                        : `lea rax, [${value.name}]`)
                }else if(value.dynamicArray){
                    ASM.addCode(`mov rax, [${value.name}]`)
                }else{
                    ASM.addCode(`lea rax, [${value.name}]`)
                }
                return
            }
            if(param.classPropertyInstance&&param.classProperty?.type==='string'){
                ASM.addCode(`mov rax, [${param.getClassPropertyAccessName()}]`)
            }else if(value.type==='string'&&!value.isParameter){
                ASM.addCode(`lea rax, [${value.name}]`)
            }else if(value.classType&&!value.isParameter){
                ASM.addCode(`lea rax, [${value.name}]`)
            }else{
                ASM.addCode(`mov rax, [${value.name}]`)
            }
            return
        }
        if(param.value instanceof FuncElement){
            ASM.addCode(`lea rax, [${param.value.name}]`)
            return
        }
        if(typeof param.value==='string'){
            const literal = param.value.match(/^(['"])([\s\S]*)\1$/)
            if(literal){
                const label = `__ds_async_string_${asyncCallId}_${index}`
                const contents = literal[2].replace(/'/g,"''")
                ASM.addData(`${label} db '${contents}',0`)
                ASM.addCode(`lea rax, [${label}]`)
                return
            }
        }
        throw new Error(`Unable to resolve argument ${index+1} for async function "${this.func?.name}"`)
    }
    emitAsyncFailure(ASM:Asm){
        ASM.addCode('mov ecx, 1')
        ASM.addCode('sub rsp, 32')
        ASM.addCode('call [ExitProcess]')
        ASM.addCode('add rsp, 32')
    }
    validateArrayPush(array:DataElement,param:FunctionArgument){
        const elementType = param.value instanceof DataElement
            ? param.value.type
            : param.arrayElementAccess?.array.type??param.arrayPropertyAccess?.property.type
        const elementClass = param.value instanceof DataElement
            ? param.value.classType
            : param.arrayElementAccess?.array.classType
        if(array.type==='number'){
            if(elementType&&elementType!=='number'){
                throw new Error(`Array.push for "${array.name}" requires a number`)
            }
            if(param.expression?.numericKind==='float'||param.value instanceof DataElement&&param.value.numericKind==='float'||param.arrayElementAccess?.array.numericKind==='float'){
                array.numericKind = 'float'
            }
            return
        }
        if(array.type==='string'){
            const literal = typeof param.value==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(param.value)
            if(!literal&&elementType!=='string'){
                throw new Error(`Array.push for "${array.name}" requires a string`)
            }
            return
        }
        if(array.classType){
            if(elementClass!==array.classType){
                throw new Error(`Array.push for "${array.name}" requires an instance of ${array.classType}`)
            }
            return
        }
        throw new Error(`Array.push is not supported for "${array.name}"`)
    }
    emitArrayPush(ASM:Asm){
        const array = this.builtinArray!
        const param = this.params[0]
        const id = this.arrayPushId!
        const valueName = `__ds_array_push_value_${id}`
        const nextCapacityName = `__ds_array_push_capacity_${id}`
        const lengthName = `${array.name}__length`
        const capacityName = `${array.name}__capacity`
        const growLabel = `__ds_array_push_grow_${id}`
        const readyLabel = `__ds_array_push_ready_${id}`
        const errorLabel = `__ds_array_push_error_${id}`
        const dynamicParameter = array.isParameter

        ASM.addData(`${valueName} dq 0`)
        ASM.addData(`${nextCapacityName} dq 0`)
        if(array.type==='string'&&typeof param.value==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(param.value)){
            const stringLabel = `__ds_array_push_string_${id}`
            const contents = param.value.slice(1,-1)
            ASM.addData(`${stringLabel} db '${contents}',0`)
            ASM.addCode(`lea rax, [${stringLabel}]`)
        }else if(array.type==='number'&&array.numericKind==='float'&&(param.expression?.numericKind==='integer'||param.value instanceof DataElement&&param.value.numericKind==='integer')){
            if(param.tempName){
                ASM.addCode(`mov rax, [${param.tempName}]`)
            }else if(param.value instanceof DataElement){
                ASM.addCode(`mov rax, [${param.value.name}]`)
            }else{
                throw new Error('Unable to resolve numeric Array.push argument')
            }
            ASM.addCode('cvtsi2sd xmm0, rax')
            ASM.addCode(`movsd qword [${valueName}], xmm0`)
            ASM.addCode(`mov rax, [${valueName}]`)
        }else if(param.arrayElementAccess||param.arrayPropertyAccess||param.tempName){
            ASM.addCode(`mov rax, [${param.tempName}]`)
        }else if(param.value instanceof DataElement){
            if(array.type==='number'){
                ASM.addCode(`mov rax, [${param.value.name}]`)
            }else if(param.value.isParameter){
                ASM.addCode(`mov rax, ${param.value.name}`)
            }else{
                ASM.addCode(`lea rax, [${param.value.name}]`)
            }
        }else{
            throw new Error('Unable to resolve Array.push argument')
        }
        if(!(array.type==='number'&&array.numericKind==='float'&&(param.expression?.numericKind==='integer'||param.value instanceof DataElement&&param.value.numericKind==='integer'))){
            ASM.addCode(`mov [${valueName}], rax`)
        }
        if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rax, [rdx+8]')
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('cmp rax, [rdx+16]')
        }else{
            ASM.addCode(`mov rax, [${lengthName}]`)
            ASM.addCode(`cmp rax, [${capacityName}]`)
        }
        ASM.addCode(`jnb ${growLabel}`)
        ASM.addCode(`jmp ${readyLabel}`)
        ASM.addCode(`${growLabel}:`)
        if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rcx, [rdx+16]')
        }else{
            ASM.addCode(`mov rcx, [${capacityName}]`)
        }
        ASM.addCode('test rcx, rcx')
        ASM.addCode(`jnz ${growLabel}_double`)
        ASM.addCode('mov rcx, 4')
        ASM.addCode(`jmp ${growLabel}_allocate`)
        ASM.addCode(`${growLabel}_double:`)
        ASM.addCode('shl rcx, 1')
        ASM.addCode(`${growLabel}_allocate:`)
        ASM.addCode(`mov [${nextCapacityName}], rcx`)
        ASM.addCode('shl rcx, 3')
        if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rdx, [rdx]')
        }else{
            ASM.addCode(`mov rdx, [${array.name}]`)
        }
        ASM.addCode('mov r8, rcx')
        ASM.addCode('mov rcx, rdx')
        ASM.addCode('mov rdx, r8')
        ASM.addImport('msvcrt','realloc')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [realloc]')
        ASM.addCode('add rsp, 40')
        ASM.addCode('test rax, rax')
        ASM.addCode(`jz ${errorLabel}`)
        if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov [rdx], rax')
            ASM.addCode(`mov rcx, [${nextCapacityName}]`)
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov [rdx+16], rcx')
        }else{
            ASM.addCode(`mov [${array.name}], rax`)
            ASM.addCode(`mov rcx, [${nextCapacityName}]`)
            ASM.addCode(`mov [${capacityName}], rcx`)
        }
        ASM.addCode(`${readyLabel}:`)
        if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rax, [rdx+8]')
        }else{
            ASM.addCode(`mov rax, [${lengthName}]`)
        }
        ASM.addCode('shl rax, 3')
        if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rdx, [rdx]')
        }else{
            ASM.addCode(`mov rdx, [${array.name}]`)
        }
        ASM.addCode('add rdx, rax')
        ASM.addCode(`mov rcx, [${valueName}]`)
        ASM.addCode('mov [rdx], rcx')
        if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('inc qword [rdx+8]')
        }else{
            ASM.addCode(`inc qword [${lengthName}]`)
        }
        ASM.addCode(`jmp ${errorLabel}_done`)
        ASM.addCode(`${errorLabel}:`)
        ASM.addCode('mov ecx, 1')
        ASM.addCode('sub rsp, 40')
        ASM.addImport('kernel32','ExitProcess')
        ASM.addCode('call [ExitProcess]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`${errorLabel}_done:`)
    }
    static getMethod(active:Base,name:string):{func:FuncElement,instance:DataElement}|null{
        const separator = name.indexOf('.')
        if(separator<1||separator===name.length-1){
            return null
        }
        const instance = active.getData(name.slice(0,separator))
        if(!instance?.classType){
            return null
        }
        const classType = active.getClass(instance.classType)
        const func = classType?.getFunction(name.slice(separator+1))
        return func?{func,instance}:null
    }
    static getPrototypeMethod(active:Base,name:string):{method:PrototypeMethod,instance:DataElement,type:string}|null{
        const separator = name.lastIndexOf('.')
        if(separator<1||separator===name.length-1){
            return null
        }
        const instance = active.getData(name.slice(0,separator))
        if(!instance){
            return null
        }
        const type = instance.isArray
            ? 'array'
            : instance.classType
                ? `class:${instance.classType}`
                : instance.type??''
        const method = TypePrototypeRegistry.resolve(type,name.slice(separator+1))
        return method?{method,instance,type}:null
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(token==='super'||token.startsWith('super.')||active.getFunction(token)||Call.getMethod(active,token)||Call.getPrototypeMethod(active,token)||active.getData(token)?.type==='Function'||active.getData(token)?.type==='function'){
            tokenizer.move(-1)
            const data = new Call(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Call