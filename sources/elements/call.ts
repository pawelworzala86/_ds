import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import FuncElement from './funcElement.ts'
import DataElement, {getNumericKind} from './dataElement.ts'
import FunctionArgument from './functionArgument.ts'
import TypePrototypeRegistry, {type PrototypeMethod} from './typePrototype.ts'
import {stringData,stringLiteralData} from '../stringLiteral.ts'
import {compileRegExpLiteral,parseRegExpLiteral} from '../regex.ts'

let arrayPushId = 0
let arrayMethodId = 0
let asyncCallId = 0
let superStringId = 0
let methodStringId = 0
let functionCallStringId = 0
let stringCharCodeAtId = 0
let stringSplitId = 0
let stringReplaceId = 0
let consoleLogId = 0

function hasSameStructLayout(properties:DataElement[],classType:ReturnType<Base['getClass']>|null){
    return Boolean(classType
        &&properties.length===classType.props.length
        &&properties.every((property,index)=>{
            const expected = classType.props[index]
            return property.name===expected.name
                &&property.type===expected.type
                &&property.isArray===expected.isArray
                &&property.classType===expected.classType
        }))
}

export class Call extends Base{
    func:FuncElement|null = null
    params:FunctionArgument[] = []
    methodInstance:DataElement|null = null
    arrayMethodArray:DataElement|null = null
    arrayMethodIndex:FunctionArgument|null = null
    builtinArray:DataElement|null = null
    builtinStringCharCodeAt:DataElement|null = null
    builtinStringSplit:DataElement|null = null
    builtinStringReplace:DataElement|null = null
    builtinConsoleLog = false
    functionVariable:DataElement|null = null
    nestedArgumentCalls = new Map<FunctionArgument,Call>()
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
        this.builtinConsoleLog = name==='console.log'
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
        if(method?.arrayMethod){
            this.arrayMethodArray = method.arrayMethod.array
            this.arrayMethodIndex = new FunctionArgument(this,method.arrayMethod.index)
            const indexNumericKind = this.arrayMethodIndex.expression?.numericKind
                ??(this.arrayMethodIndex.value instanceof DataElement?this.arrayMethodIndex.value.numericKind:'integer')
            if(indexNumericKind!=='integer'){
                throw new Error('Array index must be an integer')
            }
        }
        this.functionVariable = variable && (variable.type==='Function'||variable.type==='function') ? variable : null
        this.prototypeMethod = prototype?.method.kind==='function'
        this.prototypeReceiver = this.prototypeMethod&&Boolean(prototype&&!prototype.type.startsWith('class:'))
        this.builtinArray = prototype?.method.kind==='builtin'&&prototype.method.name==='push'
            ? prototype.instance
            : null
        this.builtinStringCharCodeAt = prototype?.method.kind==='builtin'&&prototype.method.name==='charCodeAt'
            ? prototype.instance
            : null
        this.builtinStringSplit = prototype?.method.kind==='builtin'&&prototype.method.name==='split'
            ? prototype.instance
            : null
        this.builtinStringReplace = prototype?.method.kind==='builtin'&&prototype.method.name==='replace'
            ? prototype.instance
            : null
        if(this.builtinStringSplit){
            const split = new FuncElement('__ds_string_split',[])
            split.returnArrayType = 'string[]'
            this.func = split
        }
        if(this.builtinStringReplace){
            this.func = new FuncElement('__ds_string_replace',[])
        }
        const argumentTexts = tokenizer.getCallArguments()
        this.params = argumentTexts.map(token=>new FunctionArgument(this,token))
        this.params.forEach((param,index)=>{
            const argument = argumentTexts[index]
            if(!/^[a-z_$][\w$]*\.charCodeAt\([\s\S]*\)$/i.test(argument)){
                return
            }
            const nestedTokenizer = new Tokenizer(argument)
            const nestedCall = new Call(this)
            nestedCall.set(nestedTokenizer)
            if(nestedTokenizer.has()||!nestedCall.builtinStringCharCodeAt){
                throw new Error('charCodeAt is only supported for strings')
            }
            param.tempName = `__ds_string_char_code_at_${++stringCharCodeAtId}`
            this.nestedArgumentCalls.set(param,nestedCall)
        })
        if(this.builtinStringCharCodeAt){
            if(this.params.length!==1){
                throw new Error('String.charCodeAt expects exactly one argument')
            }
            const index = this.params[0]
            const isNumericValue = Boolean(index.expression
                ||index.value instanceof DataElement&&index.value.type==='number')
            const numericKind = index.expression?.numericKind
                ??(index.value instanceof DataElement?index.value.numericKind:'integer')
            if(!isNumericValue
                ||(index.expression&&index.expression.numericKind!=='integer')
                ||(index.value instanceof DataElement&&index.value.numericKind!=='integer')
                ||numericKind!=='integer'){
                throw new Error('String.charCodeAt index must be an integer')
            }
        }
        if(this.builtinStringSplit){
            if(this.params.length!==1){
                throw new Error('String.split expects exactly one separator')
            }
            const separator = this.params[0]
            const isStringLiteral = typeof separator.value==='string'
                &&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(separator.value)
            const isRegExpLiteral = typeof separator.value==='string'
                &&Boolean(parseRegExpLiteral(separator.value))
            if(!isStringLiteral
                &&!isRegExpLiteral
                &&!(separator.value instanceof DataElement&&separator.value.type==='string'&&!separator.value.isArray)
                &&separator.classProperty?.type!=='string'){
                throw new Error('String.split separator must be a string')
            }
        }
        if(this.builtinStringReplace){
            if(this.params.length!==2){
                throw new Error('String.replace expects exactly two arguments')
            }
            const search = this.params[0]
            const replacement = this.params[1]
            const isString = (argument:FunctionArgument)=>typeof argument.value==='string'
                &&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(argument.value)
                ||argument.value instanceof DataElement&&argument.value.type==='string'&&!argument.value.isArray
                ||argument.classProperty?.type==='string'&&!argument.classProperty.isArray
            const isRegExpLiteral = typeof search.value==='string'
                &&Boolean(parseRegExpLiteral(search.value))
            if(!isRegExpLiteral&&!isString(search)){
                throw new Error('String.replace search value must be a string or regular expression literal')
            }
            if(!isString(replacement)){
                throw new Error('String.replace replacement must be a string')
            }
        }
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
            const value = this.params[0].value
            if(this.builtinArray.classType
                &&value instanceof DataElement
                &&value.classType===this.builtinArray.classType
                &&!value.isArray
                &&!value.isParameter){
                value.isHeapAllocated = true
            }
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
        if(this.arrayMethodArray&&this.arrayMethodIndex&&this.methodInstance?.name){
            const array = this.arrayMethodArray
            this.arrayMethodIndex.asm(ASM)
            const index = this.arrayMethodIndex.getCode(true)
            if(index===null){
                throw new Error('Unable to resolve array method index')
            }
            ASM.addData(`${this.methodInstance.name} dq 0`)
            ASM.addCode(`mov rax, ${index}`)
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
            ASM.addCode(`mov [${this.methodInstance.name}], rax`)
        }
        for(const param of this.params){
            const nestedCall = this.nestedArgumentCalls.get(param)
            if(nestedCall){
                nestedCall.asm(ASM)
                ASM.addData(`${param.tempName} dq 0`)
                ASM.addCode(`mov [${param.tempName}], rax`)
            }else{
                param.asm(ASM)
            }
        }
        if(this.builtinConsoleLog){
            this.emitConsoleLog(ASM)
            return
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
        if(this.builtinStringCharCodeAt){
            this.emitStringCharCodeAt(ASM)
            return
        }
        if(this.builtinStringSplit){
            this.emitStringSplit(ASM)
            return
        }
        if(this.builtinStringReplace){
            this.emitStringReplace(ASM)
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
                }else if(param.value instanceof DataElement&&param.value.type==='string'&&!param.value.isArray){
                    return param.value.isParameter?`[${value}]`:value
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
        if(this.methodInstance?.isProcedureLocal){
            this.emitLocalMethodCall(ASM)
            return
        }
        const canEmitArguments = this.params.every(param=>
            param.value instanceof DataElement
            ||param.tempName!==null
            ||param.arrayPointerName!==null
            ||typeof param.value==='string'&&/^(['"])[\s\S]*\1$/.test(param.value)
        )
        if(canEmitArguments&&!this.methodInstance){
            for(let index=0;index<this.params.length;index++){
                const param = this.params[index]
                const expected = this.func?.params[index]
                const expectedClass = expected?.type?this.getClass(expected.type):null
                if(expected?.dynamicArray&&param.value instanceof DataElement&&param.value.isArray){
                    ASM.addCode(param.value.isParameter
                        ? `mov rax, ${param.value.name}`
                        : `lea rax, [${param.value.name}]`)
                }else if(typeof param.value==='string'&&/^(['"])[\s\S]*\1$/.test(param.value)){
                    const label = `__ds_function_call_string_${++functionCallStringId}`
                    ASM.addData(`${label} ${stringLiteralData(param.value)}`)
                    ASM.addCode(`lea rax, [${label}]`)
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
                }else if(param.value instanceof DataElement&&param.value.type==='string'&&!param.value.isArray){
                    const value = param.value
                    if(value.isReferenceAlias){
                        ASM.addCode(`mov rdx, [${value.name}]`)
                        ASM.addCode('mov rax, [rdx]')
                    }else{
                        ASM.addCode(value.isParameter
                            ? `mov rax, ${value.name}`
                            : `mov rax, [${value.getAccessName()}]`)
                    }
                }else if(param.value instanceof DataElement&&param.value.classType
                    &&(expected?.type===param.value.classType||param.value.classLayoutProps&&hasSameStructLayout(param.value.classLayoutProps,expectedClass))){
                    ASM.addCode(param.value.isProcedureLocal&&param.value.isHeapAllocated
                        ? `mov rax, [${param.value.name}]`
                        : `lea rax, [${param.value.name}]`)
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
    emitConsoleLog(ASM:Asm){
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

        if(!this.params.length){
            emitPrintf('\n')
            return
        }
        this.params.forEach((param,index)=>{
            const prefix = index===0?'':' '
            const value = param.value
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

            const data = value instanceof DataElement?value:null
            const type = param.classProperty?.type??data?.type
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
                    argument = data.isProcedureLocal&&data.isHeapAllocated
                        ? `[${data.name}]`
                        : `addr ${data.name}`
                }
            }
            if(!argument){
                throw new Error('Unable to resolve console.log argument')
            }
            emitPrintf(`${prefix}%p`,argument)
        })
        emitPrintf('\n')
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
                ASM.addData(`__ds_super_string_${superStringId} ${stringData(literal[2])}`)
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
    emitLocalMethodCall(ASM:Asm){
        const instance = this.methodInstance
        if(!instance?.classType||!instance.name||!this.func?.name){
            throw new Error('Local method call target is not initialized')
        }
        const registers = ['rdx','r8','r9']
        const totalArguments = this.params.length+1
        const stackBytes = 32+Math.max(0,totalArguments-4)*8
        const stackSize = stackBytes+(stackBytes%16===0?8:0)
        ASM.addCode(`sub rsp, ${stackSize}`)
        ASM.addCode(instance.isHeapAllocated
            ? `mov rcx, [${instance.name}]`
            : `lea rcx, [${instance.name}]`)
        this.params.forEach((param,index)=>{
            const expected = this.func!.params[index]
            const value = expected?.dynamicArray&&param.value instanceof DataElement&&param.value.isArray
                ? param.value.isParameter?param.value.name:`addr ${param.value.name}`
                : param.getCode(true)
            if(value===null){
                throw new Error(`Unable to resolve local method argument ${index+1}`)
            }
            const literal = value.match(/^(['"])([\s\S]*)\1$/)
            const argument = literal
                ? `addr __ds_method_string_${++methodStringId}`
                : value
            if(literal){
                ASM.addData(`__ds_method_string_${methodStringId} ${stringData(literal[2])}`)
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
        ASM.addCode(`call ${instance.classType}.${this.func.name}`)
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
            }else if(value.type==='string'){
                if(value.isReferenceAlias){
                    ASM.addCode(`mov rdx, [${value.name}]`)
                    ASM.addCode('mov rax, [rdx]')
                }else if(value.isParameter){
                    ASM.addCode(`mov rax, ${value.name}`)
                }else{
                    ASM.addCode(`mov rax, [${value.name}]`)
                }
            }else if(value.classType&&!value.isParameter){
                ASM.addCode(value.isProcedureLocal&&value.isHeapAllocated
                    ? `mov rax, [${value.name}]`
                    : `lea rax, [${value.name}]`)
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
                ASM.addData(`${label} ${stringData(literal[2])}`)
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
    emitStringCharCodeAt(ASM:Asm){
        const string = this.builtinStringCharCodeAt
        const index = this.params[0]
        if(!string||!index){
            throw new Error('String.charCodeAt is not initialized')
        }
        const stringValue = string.getCode(true)
        if(stringValue===null){
            throw new Error('Unable to resolve String.charCodeAt receiver')
        }
        if(stringValue.startsWith('addr ')){
            ASM.addCode(`lea rdx, [${stringValue.replace(/^addr\s+/,'')}]`)
        }else{
            ASM.addCode(`mov rdx, ${stringValue}`)
        }
        const indexValue = index.getCode(true)
        if(indexValue===null||indexValue.startsWith('addr ')){
            throw new Error('Unable to resolve String.charCodeAt index')
        }
        ASM.addCode(`mov rax, ${indexValue}`)
        ASM.addCode('add rdx, rax')
        ASM.addCode('movzx eax, byte [rdx]')
    }
    emitStringSplit(ASM:Asm){
        const string = this.builtinStringSplit
        const separator = this.params[0]
        if(!string||!separator){
            throw new Error('String.split is not initialized')
        }
        const stringValue = string.getCode(true)
        const separatorValue = separator.getCode(true)
        if(stringValue===null||separatorValue===null){
            throw new Error('Unable to resolve String.split arguments')
        }

        const id = ++stringSplitId
        const regexpLiteral = typeof separator.value==='string'&&parseRegExpLiteral(separator.value)
            ? separator.value
            : null
        const compiledRegExp = regexpLiteral?compileRegExpLiteral(regexpLiteral):null
        const helperName = `__ds_string_split_${id}`
        const source = `__ds_split_${id}_source`
        const separatorPointer = `__ds_split_${id}_separator`
        const sourceLength = `__ds_split_${id}_source_length`
        const separatorLength = `__ds_split_${id}_separator_length`
        const index = `__ds_split_${id}_index`
        const segmentStart = `__ds_split_${id}_segment_start`
        const segmentLength = `__ds_split_${id}_segment_length`
        const result = `__ds_split_${id}_result`
        const items = `__ds_split_${id}_items`
        const capacity = `__ds_split_${id}_capacity`
        const count = `__ds_split_${id}_count`
        const segment = `__ds_split_${id}_segment`
        const matchPointer = `__ds_split_${id}_match_pointer`
        const resume = `__ds_split_${id}_resume`
        const mainLoop = `__ds_split_${id}_main_loop`
        const matched = `__ds_split_${id}_matched`
        const finalSegment = `__ds_split_${id}_final_segment`
        const emptySeparator = `__ds_split_${id}_empty_separator`
        const emptyLoop = `__ds_split_${id}_empty_loop`
        const appendSegment = `__ds_split_${id}_append_segment`
        const appendDispatch = `__ds_split_${id}_append_dispatch`
        const appendCapture = `__ds_split_${id}_append_capture`
        const afterMatch = `__ds_split_${id}_after_match`
        const afterFinal = `__ds_split_${id}_after_final`
        const afterEmpty = `__ds_split_${id}_after_empty`
        const done = `__ds_split_${id}_done`
        const allocationFailure = `__ds_split_${id}_allocation_failure`
        const scanStart = `__ds_split_${id}_scan_start`
        const scanPosition = `__ds_split_${id}_scan_position`
        const dfaState = `__ds_split_${id}_dfa_state`
        const lastMatchEnd = `__ds_split_${id}_last_match_end`
        const tryMatchStart = `__ds_split_${id}_try_match_start`
        const consumeMatch = `__ds_split_${id}_consume_match`
        const matchFinished = `__ds_split_${id}_match_finished`
        const recordMatch = `__ds_split_${id}_record_match`
        const matchFound = `__ds_split_${id}_match_found`
        const transitionTable = `__ds_split_${id}_transition_table`
        const transitionRows = compiledRegExp?.transitions.map((row,index)=>
            `${index===0?transitionTable:`${transitionTable}_row_${index}`} db ${row.join(',')}`
        )??[]
        const acceptingTransitions = compiledRegExp?.acceptingStates.flatMap(state=>[
            `cmp qword [${dfaState}], ${state}`,
            `je ${recordMatch}`
        ])??[]
        const regexpMatcher = compiledRegExp?[
            `mov rax, [${index}]`,
            `mov [${scanStart}], rax`,
            `${tryMatchStart}:`,
            `mov rax, [${scanStart}]`,
            `cmp rax, [${sourceLength}]`,
            `jnb ${finalSegment}`,
            `mov [${scanPosition}], rax`,
            `mov qword [${dfaState}], 1`,
            `mov qword [${lastMatchEnd}], -1`,
            `${consumeMatch}:`,
            `mov rax, [${scanPosition}]`,
            `cmp rax, [${sourceLength}]`,
            `jnb ${matchFinished}`,
            `mov rdx, [${source}]`,
            `add rdx, rax`,
            'movzx eax, byte [rdx]',
            `mov rdx, [${dfaState}]`,
            'shl rdx, 8',
            `lea r8, [${transitionTable}]`,
            'add rdx, r8',
            'add rdx, rax',
            'movzx eax, byte [rdx]',
            'test eax, eax',
            `jz ${matchFinished}`,
            `mov [${dfaState}], rax`,
            `inc qword [${scanPosition}]`,
            ...acceptingTransitions,
            `jmp ${consumeMatch}`,
            `${recordMatch}:`,
            `mov rax, [${scanPosition}]`,
            `mov [${lastMatchEnd}], rax`,
            `jmp ${consumeMatch}`,
            `${matchFinished}:`,
            `cmp qword [${lastMatchEnd}], -1`,
            `jne ${matchFound}`,
            `inc qword [${scanStart}]`,
            `jmp ${tryMatchStart}`,
            `${matchFound}:`,
            `mov rax, [${source}]`,
            `add rax, [${scanStart}]`,
            `mov [${matchPointer}], rax`,
            `mov rax, [${lastMatchEnd}]`,
            `sub rax, [${scanStart}]`,
            `mov [${separatorLength}], rax`,
            `jmp ${matched}`
        ]:[
            `mov rcx, [${source}]`,
            `add rcx, [${index}]`,
            `mov rdx, [${separatorPointer}]`,
            'sub rsp, 40',
            'call [strstr]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${finalSegment}`,
            `mov [${matchPointer}], rax`
        ]

        ASM.addImport('msvcrt','malloc')
        ASM.addImport('msvcrt','memset')
        ASM.addImport('msvcrt','memcpy')
        ASM.addImport('msvcrt','strlen')
        if(!compiledRegExp){
            ASM.addImport('msvcrt','strstr')
        }
        ASM.addImport('kernel32','ExitProcess')
        const helper = [
            `proc ${helperName}`,
            `local ${source} dq 0`,
            `local ${separatorPointer} dq 0`,
            `local ${sourceLength} dq 0`,
            `local ${separatorLength} dq 0`,
            `local ${index} dq 0`,
            `local ${segmentStart} dq 0`,
            `local ${segmentLength} dq 0`,
            `local ${result} dq 0`,
            `local ${items} dq 0`,
            `local ${capacity} dq 0`,
            `local ${count} dq 0`,
            `local ${segment} dq 0`,
            `local ${matchPointer} dq 0`,
            `local ${resume} dq 0`,
            ...(compiledRegExp?[
                `local ${scanStart} dq 0`,
                `local ${scanPosition} dq 0`,
                `local ${dfaState} dq 0`,
                `local ${lastMatchEnd} dq 0`
            ]:[]),
            `mov [${source}], rcx`,
            `mov [${separatorPointer}], rdx`,
            `mov rcx, [${source}]`,
            'sub rsp, 40',
            'call [strlen]',
            'add rsp, 40',
            `mov [${sourceLength}], rax`,
            `mov rcx, [${separatorPointer}]`,
            'sub rsp, 40',
            'call [strlen]',
            'add rsp, 40',
            `mov [${separatorLength}], rax`,
            'mov rcx, 24',
            'sub rsp, 40',
            'call [malloc]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${allocationFailure}`,
            `mov [${result}], rax`,
            `mov rax, [${sourceLength}]`,
            'inc rax',
            ...(compiledRegExp?.capturesWholeSeparator?['shl rax, 1']:[]),
            `mov [${capacity}], rax`,
            'shl rax, 3',
            'mov rcx, rax',
            'sub rsp, 40',
            'call [malloc]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${allocationFailure}`,
            `mov [${items}], rax`,
            `mov rdx, [${result}]`,
            `mov [rdx], rax`,
            `mov rax, [${capacity}]`,
            `mov [rdx+16], rax`,
            `mov qword [rdx+8], 0`,
            `mov qword [${index}], 0`,
            `mov qword [${segmentStart}], 0`,
            `mov qword [${count}], 0`,
            `cmp qword [${separatorLength}], 0`,
            compiledRegExp?`jmp ${mainLoop}`:`je ${emptySeparator}`,
            `${mainLoop}:`,
            `mov rax, [${index}]`,
            `cmp rax, [${sourceLength}]`,
            `jnb ${finalSegment}`,
            ...regexpMatcher,
            `${matched}:`,
            `mov rax, [${matchPointer}]`,
            `sub rax, [${source}]`,
            `mov [${index}], rax`,
            `mov rax, [${index}]`,
            `sub rax, [${segmentStart}]`,
            `mov [${segmentLength}], rax`,
            `mov qword [${resume}], 0`,
            `jmp ${appendSegment}`,
            `${afterMatch}:`,
            `mov rax, [${index}]`,
            `add rax, [${separatorLength}]`,
            `mov [${index}], rax`,
            `mov [${segmentStart}], rax`,
            `jmp ${mainLoop}`,
            `${finalSegment}:`,
            `mov rax, [${sourceLength}]`,
            `sub rax, [${segmentStart}]`,
            `mov [${segmentLength}], rax`,
            `mov qword [${resume}], 1`,
            `jmp ${appendSegment}`,
            `${afterFinal}:`,
            `jmp ${done}`,
            `${emptySeparator}:`,
            `cmp qword [${sourceLength}], 0`,
            `je ${done}`,
            `mov qword [${index}], 0`,
            `${emptyLoop}:`,
            `mov rax, [${index}]`,
            `cmp rax, [${sourceLength}]`,
            `jnb ${done}`,
            `mov [${segmentStart}], rax`,
            `mov qword [${segmentLength}], 1`,
            `mov qword [${resume}], 2`,
            `jmp ${appendSegment}`,
            `${afterEmpty}:`,
            `inc qword [${index}]`,
            `jmp ${emptyLoop}`,
            `${appendSegment}:`,
            `mov rcx, [${segmentLength}]`,
            'inc rcx',
            'sub rsp, 40',
            'call [malloc]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${allocationFailure}`,
            `mov [${segment}], rax`,
            `mov rcx, [${segment}]`,
            `mov rdx, [${source}]`,
            `add rdx, [${segmentStart}]`,
            `mov r8, [${segmentLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            `${appendDispatch}:`,
            `mov rcx, [${segment}]`,
            `add rcx, [${segmentLength}]`,
            'xor edx, edx',
            'mov r8, 1',
            'sub rsp, 40',
            'call [memset]',
            'add rsp, 40',
            `mov rax, [${count}]`,
            'shl rax, 3',
            `mov rdx, [${items}]`,
            'add rdx, rax',
            `mov rcx, [${segment}]`,
            'mov [rdx], rcx',
            `inc qword [${count}]`,
            `cmp qword [${resume}], 0`,
            `je ${compiledRegExp?.capturesWholeSeparator?appendCapture:afterMatch}`,
            `cmp qword [${resume}], 1`,
            `je ${afterFinal}`,
            `jmp ${afterEmpty}`,
            ...(compiledRegExp?.capturesWholeSeparator?[
                `${appendCapture}:`,
                `mov rcx, [${separatorLength}]`,
                'inc rcx',
                'sub rsp, 40',
                'call [malloc]',
                'add rsp, 40',
                'test rax, rax',
                `jz ${allocationFailure}`,
                `mov [${segment}], rax`,
                `mov rcx, [${segment}]`,
                `mov rdx, [${source}]`,
                `add rdx, [${index}]`,
                `mov r8, [${separatorLength}]`,
                'sub rsp, 40',
                'call [memcpy]',
                'add rsp, 40',
                `mov rcx, [${segment}]`,
                `add rcx, [${separatorLength}]`,
                'xor edx, edx',
                'mov r8, 1',
                'sub rsp, 40',
                'call [memset]',
                'add rsp, 40',
                `mov rax, [${count}]`,
                'shl rax, 3',
                `mov rdx, [${items}]`,
                'add rdx, rax',
                `mov rcx, [${segment}]`,
                'mov [rdx], rcx',
                `inc qword [${count}]`,
                `jmp ${afterMatch}`
            ]:[]),
            `${allocationFailure}:`,
            'mov ecx, 1',
            'sub rsp, 40',
            'call [ExitProcess]',
            'add rsp, 40',
            `jmp ${allocationFailure}`,
            `${done}:`,
            `mov rdx, [${result}]`,
            `mov rax, [${count}]`,
            `mov [rdx+8], rax`,
            `mov rax, [${result}]`,
            'ret',
            'endp'
        ].join('\n')
        if(compiledRegExp){
            ASM.addData(transitionRows.join('\n'))
        }
        ASM.addProc(helper)

        let separatorArgument = separatorValue
        if(compiledRegExp){
            const label = `__ds_string_split_separator_${id}`
            ASM.addData(`${label} db 0`)
            separatorArgument = `addr ${label}`
        }else if(typeof separator.value==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(separator.value)){
            const label = `__ds_string_split_separator_${id}`
            ASM.addData(`${label} ${stringLiteralData(separator.value)}`)
            separatorArgument = `addr ${label}`
        }
        const emitPointer = (register:string,value:string)=>{
            if(value.startsWith('addr ')){
                ASM.addCode(`lea ${register}, [${value.replace(/^addr\s+/,'')}]`)
            }else{
                ASM.addCode(`mov ${register}, ${value}`)
            }
        }
        emitPointer('rcx',stringValue)
        emitPointer('rdx',separatorArgument)
        ASM.addCode('sub rsp, 40')
        ASM.addCode(`call ${helperName}`)
        ASM.addCode('add rsp, 40')
    }
    emitStringReplace(ASM:Asm){
        const string = this.builtinStringReplace
        const search = this.params[0]
        const replacement = this.params[1]
        if(!string||!search||!replacement){
            throw new Error('String.replace is not initialized')
        }
        const stringValue = string.getCode(true)
        const searchValue = search.getCode(true)
        const replacementValue = replacement.getCode(true)
        if(stringValue===null||searchValue===null||replacementValue===null){
            throw new Error('Unable to resolve String.replace arguments')
        }

        const id = ++stringReplaceId
        const regexpLiteral = typeof search.value==='string'&&parseRegExpLiteral(search.value)
            ? search.value
            : null
        const compiledRegExp = regexpLiteral?compileRegExpLiteral(regexpLiteral):null
        const isGlobal = Boolean(regexpLiteral&&parseRegExpLiteral(regexpLiteral)?.flags.includes('g'))
        const helperName = `__ds_string_replace_${id}`
        const source = `__ds_replace_${id}_source`
        const searchPointer = `__ds_replace_${id}_search`
        const replacementPointer = `__ds_replace_${id}_replacement`
        const sourceLength = `__ds_replace_${id}_source_length`
        const searchLength = `__ds_replace_${id}_search_length`
        const replacementLength = `__ds_replace_${id}_replacement_length`
        const output = `__ds_replace_${id}_output`
        const outputCapacity = `__ds_replace_${id}_output_capacity`
        const outputLength = `__ds_replace_${id}_output_length`
        const searchStart = `__ds_replace_${id}_search_start`
        const segmentStart = `__ds_replace_${id}_segment_start`
        const segmentLength = `__ds_replace_${id}_segment_length`
        const matchStart = `__ds_replace_${id}_match_start`
        const matchEnd = `__ds_replace_${id}_match_end`
        const matchPointer = `__ds_replace_${id}_match_pointer`
        const afterReplacement = `__ds_replace_${id}_after_replacement`
        const mainLoop = `__ds_replace_${id}_main_loop`
        const matched = `__ds_replace_${id}_matched`
        const noMatch = `__ds_replace_${id}_no_match`
        const copyTail = `__ds_replace_${id}_copy_tail`
        const done = `__ds_replace_${id}_done`
        const allocationFailure = `__ds_replace_${id}_allocation_failure`
        const scanStart = `__ds_replace_${id}_scan_start`
        const scanPosition = `__ds_replace_${id}_scan_position`
        const dfaState = `__ds_replace_${id}_dfa_state`
        const lastMatchEnd = `__ds_replace_${id}_last_match_end`
        const tryMatchStart = `__ds_replace_${id}_try_match_start`
        const consumeMatch = `__ds_replace_${id}_consume_match`
        const matchFinished = `__ds_replace_${id}_match_finished`
        const recordMatch = `__ds_replace_${id}_record_match`
        const matchFound = `__ds_replace_${id}_match_found`
        const transitionTable = `__ds_replace_${id}_transition_table`
        const transitionRows = compiledRegExp?.transitions.map((row,index)=>
            `${index===0?transitionTable:`${transitionTable}_row_${index}`} db ${row.join(',')}`
        )??[]
        const acceptingTransitions = compiledRegExp?.acceptingStates.flatMap(state=>[
            `cmp qword [${dfaState}], ${state}`,
            `je ${recordMatch}`
        ])??[]
        const regexpMatcher = compiledRegExp?[
            `mov rax, [${searchStart}]`,
            `mov [${scanStart}], rax`,
            `${tryMatchStart}:`,
            `mov rax, [${scanStart}]`,
            `cmp rax, [${sourceLength}]`,
            `jnb ${noMatch}`,
            `mov [${scanPosition}], rax`,
            `mov qword [${dfaState}], 1`,
            `mov qword [${lastMatchEnd}], -1`,
            `${consumeMatch}:`,
            `mov rax, [${scanPosition}]`,
            `cmp rax, [${sourceLength}]`,
            `jnb ${matchFinished}`,
            `mov rdx, [${source}]`,
            `add rdx, rax`,
            'movzx eax, byte [rdx]',
            `mov rdx, [${dfaState}]`,
            'shl rdx, 8',
            `lea r8, [${transitionTable}]`,
            'add rdx, r8',
            'add rdx, rax',
            'movzx eax, byte [rdx]',
            'test eax, eax',
            `jz ${matchFinished}`,
            `mov [${dfaState}], rax`,
            `inc qword [${scanPosition}]`,
            ...acceptingTransitions,
            `jmp ${consumeMatch}`,
            `${recordMatch}:`,
            `mov rax, [${scanPosition}]`,
            `mov [${lastMatchEnd}], rax`,
            `jmp ${consumeMatch}`,
            `${matchFinished}:`,
            `cmp qword [${lastMatchEnd}], -1`,
            `jne ${matchFound}`,
            `inc qword [${scanStart}]`,
            `jmp ${tryMatchStart}`,
            `${matchFound}:`,
            `mov rax, [${scanStart}]`,
            `mov [${matchStart}], rax`,
            `mov rax, [${lastMatchEnd}]`,
            `mov [${matchEnd}], rax`,
            `jmp ${matched}`
        ]:[
            `mov rcx, [${source}]`,
            `add rcx, [${searchStart}]`,
            `mov rdx, [${searchPointer}]`,
            'sub rsp, 40',
            'call [strstr]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${noMatch}`,
            `mov [${matchPointer}], rax`,
            `mov rax, [${matchPointer}]`,
            `sub rax, [${source}]`,
            `mov [${matchStart}], rax`,
            `add rax, [${searchLength}]`,
            `mov [${matchEnd}], rax`,
            `jmp ${matched}`
        ]

        ASM.addImport('msvcrt','malloc')
        ASM.addImport('msvcrt','memcpy')
        ASM.addImport('msvcrt','strlen')
        if(!compiledRegExp){
            ASM.addImport('msvcrt','strstr')
        }
        ASM.addImport('kernel32','ExitProcess')
        const helper = [
            `proc ${helperName}`,
            `local ${source} dq 0`,
            `local ${searchPointer} dq 0`,
            `local ${replacementPointer} dq 0`,
            `local ${sourceLength} dq 0`,
            `local ${searchLength} dq 0`,
            `local ${replacementLength} dq 0`,
            `local ${output} dq 0`,
            `local ${outputCapacity} dq 0`,
            `local ${outputLength} dq 0`,
            `local ${searchStart} dq 0`,
            `local ${segmentStart} dq 0`,
            `local ${segmentLength} dq 0`,
            `local ${matchStart} dq 0`,
            `local ${matchEnd} dq 0`,
            `local ${matchPointer} dq 0`,
            ...(compiledRegExp?[
                `local ${scanStart} dq 0`,
                `local ${scanPosition} dq 0`,
                `local ${dfaState} dq 0`,
                `local ${lastMatchEnd} dq 0`
            ]:[]),
            `mov [${source}], rcx`,
            `mov [${searchPointer}], rdx`,
            `mov [${replacementPointer}], r8`,
            `mov rcx, [${source}]`,
            'sub rsp, 40',
            'call [strlen]',
            'add rsp, 40',
            `mov [${sourceLength}], rax`,
            `mov rcx, [${searchPointer}]`,
            'sub rsp, 40',
            'call [strlen]',
            'add rsp, 40',
            `mov [${searchLength}], rax`,
            `mov rcx, [${replacementPointer}]`,
            'sub rsp, 40',
            'call [strlen]',
            'add rsp, 40',
            `mov [${replacementLength}], rax`,
            `mov rax, [${sourceLength}]`,
            `mov rdx, [${replacementLength}]`,
            'imul rax, rdx',
            `add rax, [${sourceLength}]`,
            `add rax, [${replacementLength}]`,
            'inc rax',
            `mov [${outputCapacity}], rax`,
            'mov rcx, rax',
            'sub rsp, 40',
            'call [malloc]',
            'add rsp, 40',
            'test rax, rax',
            `jz ${allocationFailure}`,
            `mov [${output}], rax`,
            `mov qword [${outputLength}], 0`,
            `mov qword [${searchStart}], 0`,
            `mov qword [${segmentStart}], 0`,
            `${mainLoop}:`,
            ...regexpMatcher,
            `${matched}:`,
            `mov rax, [${matchStart}]`,
            `sub rax, [${segmentStart}]`,
            `mov [${segmentLength}], rax`,
            `mov rcx, [${output}]`,
            `add rcx, [${outputLength}]`,
            `mov rdx, [${source}]`,
            `add rdx, [${segmentStart}]`,
            `mov r8, [${segmentLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            `mov rax, [${outputLength}]`,
            `add rax, [${segmentLength}]`,
            `mov [${outputLength}], rax`,
            `cmp qword [${replacementLength}], 0`,
            `je ${afterReplacement}`,
            `mov rcx, [${output}]`,
            `add rcx, [${outputLength}]`,
            `mov rdx, [${replacementPointer}]`,
            `mov r8, [${replacementLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            `mov rax, [${outputLength}]`,
            `add rax, [${replacementLength}]`,
            `mov [${outputLength}], rax`,
            `${afterReplacement}:`,
            `mov rax, [${matchEnd}]`,
            `mov [${segmentStart}], rax`,
            `mov [${searchStart}], rax`,
            ...(isGlobal?[`jmp ${mainLoop}`]:[`jmp ${copyTail}`]),
            `${noMatch}:`,
            `${copyTail}:`,
            `mov rax, [${sourceLength}]`,
            `sub rax, [${segmentStart}]`,
            `mov [${segmentLength}], rax`,
            `mov rcx, [${output}]`,
            `add rcx, [${outputLength}]`,
            `mov rdx, [${source}]`,
            `add rdx, [${segmentStart}]`,
            `mov r8, [${segmentLength}]`,
            'sub rsp, 40',
            'call [memcpy]',
            'add rsp, 40',
            `mov rax, [${output}]`,
            `add rax, [${outputLength}]`,
            `add rax, [${segmentLength}]`,
            'mov byte [rax], 0',
            `mov rax, [${output}]`,
            `jmp ${done}`,
            `${allocationFailure}:`,
            'mov ecx, 1',
            'sub rsp, 40',
            'call [ExitProcess]',
            'add rsp, 40',
            `jmp ${allocationFailure}`,
            `${done}:`,
            'ret',
            'endp'
        ].join('\n')
        if(compiledRegExp){
            ASM.addData(transitionRows.join('\n'))
        }
        ASM.addProc(helper)

        let searchArgument = searchValue
        let replacementArgument = replacementValue
        if(compiledRegExp){
            const label = `__ds_string_replace_search_${id}`
            ASM.addData(`${label} db 0`)
            searchArgument = `addr ${label}`
        }else if(typeof search.value==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(search.value)){
            const label = `__ds_string_replace_search_${id}`
            ASM.addData(`${label} ${stringLiteralData(search.value)}`)
            searchArgument = `addr ${label}`
        }
        if(typeof replacement.value==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(replacement.value)){
            const label = `__ds_string_replace_replacement_${id}`
            ASM.addData(`${label} ${stringLiteralData(replacement.value)}`)
            replacementArgument = `addr ${label}`
        }
        const emitPointer = (register:string,value:string)=>{
            if(value.startsWith('addr ')){
                ASM.addCode(`lea ${register}, [${value.replace(/^addr\s+/,'')}]`)
            }else{
                ASM.addCode(`mov ${register}, ${value}`)
            }
        }
        emitPointer('rcx',stringValue)
        emitPointer('rdx',searchArgument)
        emitPointer('r8',replacementArgument)
        ASM.addCode('sub rsp, 40')
        ASM.addCode(`call ${helperName}`)
        ASM.addCode('add rsp, 40')
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
            ASM.addData(`${stringLabel} ${stringLiteralData(param.value)}`)
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
            }else if(param.value.isProcedureLocal&&param.value.isHeapAllocated){
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
    static getMethod(active:Base,name:string):{
        func:FuncElement
        instance:DataElement
        arrayMethod?:{array:DataElement,index:string}
    }|null{
        const arrayElementMethod = name.match(/^([a-z_$][\w$]*)\[([^\]]+)\]\.([a-z_$][\w$]*)$/i)
        if(arrayElementMethod){
            const [,arrayName,index,methodName] = arrayElementMethod
            const array = active.getData(arrayName)
            if(!array?.isArray||!array.classType){
                return null
            }
            const classType = active.getClass(array.classType)
            const func = classType?.getFunction(methodName)
            if(!func){
                return null
            }
            const instance = new DataElement(
                'let',
                `__ds_array_method_instance_${++arrayMethodId}`,
                array.classType,
                '0'
            )
            instance.classType = array.classType
            instance.isProcedureLocal = true
            instance.isHeapAllocated = true
            return {func,instance,arrayMethod:{array,index}}
        }
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
        if(token==='console.log'||token==='super'||token.startsWith('super.')||active.getFunction(token)||Call.getMethod(active,token)||Call.getPrototypeMethod(active,token)||active.getData(token)?.type==='Function'||active.getData(token)?.type==='function'){
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