import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import FuncElement from './funcElement.ts'
import DataElement, {getNumericKind} from './dataElement.ts'
import FunctionArgument from './functionArgument.ts'
import TypePrototypeRegistry, {type PrototypeMethod} from './typePrototype.ts'
import {stringData,stringLiteralData} from '../stringLiteral.ts'
import {compileRegExpLiteral,parseRegExpLiteral} from '../regex.ts'
import {emitCall as emitCallImpl} from './call/emit.ts'
import {emitConsoleLog as emitConsoleLogImpl} from './call/consoleLog.ts'
import {emitSuperCall as emitSuperCallImpl} from './call/superCall.ts'
import {emitLocalMethodCall as emitLocalMethodCallImpl} from './call/localMethodCall.ts'
import {emitAsyncCall as emitAsyncCallImpl,emitAsyncArgument as emitAsyncArgumentImpl,emitAsyncFailure as emitAsyncFailureImpl} from './call/asyncCall.ts'
import {validateArrayPush as validateArrayPushImpl} from './call/arrayValidation.ts'
import {emitArrayPush as emitArrayPushImpl} from './call/arrayPush.ts'
import {emitStringCharCodeAt as emitStringCharCodeAtImpl} from './call/stringCharCodeAt.ts'
import {emitStringSplit as emitStringSplitImpl} from './call/stringSplit.ts'
import {emitStringReplace as emitStringReplaceImpl} from './call/stringReplace.ts'
import {emitStringSearch as emitStringSearchImpl} from './call/stringSearch.ts'
import {getMethod as getMethodImpl,getPrototypeMethod as getPrototypeMethodImpl} from './call/methodLookup.ts'

let arrayPushId = 0
let stringCharCodeAtId = 0

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
    builtinStringSearch:DataElement|null = null
    builtinStringSearchMethod:string|null = null
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
        const stringSearchMethods = ['indexOf','includes','startsWith','endsWith']
        this.builtinStringSearchMethod = prototype?.method.kind==='builtin'
            &&stringSearchMethods.includes(prototype.method.name)
            ? prototype.method.name
            : null
        this.builtinStringSearch = this.builtinStringSearchMethod?prototype!.instance:null
        if(this.builtinStringSplit){
            const split = new FuncElement('__ds_string_split',[])
            split.returnArrayType = 'string[]'
            this.func = split
        }
        if(this.builtinStringReplace){
            this.func = new FuncElement('__ds_string_replace',[])
        }
        if(this.builtinStringSearch){
            this.func = new FuncElement(`__ds_string_${this.builtinStringSearchMethod}`,[])
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
        if(this.builtinStringSearch){
            if(this.params.length!==1){
                throw new Error(`String.${this.builtinStringSearchMethod} expects exactly one string argument`)
            }
            const search = this.params[0]
            const isString = typeof search.value==='string'
                &&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(search.value)
                ||search.value instanceof DataElement&&search.value.type==='string'&&!search.value.isArray
                ||search.classProperty?.type==='string'&&!search.classProperty.isArray
            if(!isString){
                throw new Error(`String.${this.builtinStringSearchMethod} search value must be a string`)
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
        emitCallImpl(this,ASM,asyncMode)
    }
    emitConsoleLog(ASM:Asm){
        emitConsoleLogImpl(this,ASM)
    }
    emitSuperCall(ASM:Asm){
        emitSuperCallImpl(this,ASM)
    }
    emitLocalMethodCall(ASM:Asm){
        emitLocalMethodCallImpl(this,ASM)
    }
    emitAsyncCall(ASM:Asm,mode:'detached'|'handle'|'await'='detached'){
        emitAsyncCallImpl(this,ASM,mode)
    }
    emitAsyncArgument(ASM:Asm,param:FunctionArgument,expected:{name:string,type:string,dynamicArray?:boolean},index:number){
        emitAsyncArgumentImpl(this,ASM,param,expected,index)
    }
    emitAsyncFailure(ASM:Asm){
        emitAsyncFailureImpl(this,ASM)
    }
    validateArrayPush(array:DataElement,param:FunctionArgument){
        validateArrayPushImpl(this,array,param)
    }
    emitStringCharCodeAt(ASM:Asm){
        emitStringCharCodeAtImpl(this,ASM)
    }
    emitStringSplit(ASM:Asm){
        emitStringSplitImpl(this,ASM)
    }
    emitStringReplace(ASM:Asm){
        emitStringReplaceImpl(this,ASM)
    }
    emitStringSearch(ASM:Asm){
        emitStringSearchImpl(this,ASM)
    }
    emitArrayPush(ASM:Asm){
        emitArrayPushImpl(this,ASM)
    }
    static getMethod(active:Base,name:string):{
        func:FuncElement
        instance:DataElement
        arrayMethod?:{array:DataElement,index:string}
    }|null{
        return getMethodImpl(active,name)
    }
    static getPrototypeMethod(active:Base,name:string):{method:PrototypeMethod,instance:DataElement,type:string}|null{
        return getPrototypeMethodImpl(active,name)
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