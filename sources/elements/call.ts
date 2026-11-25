import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import FuncElement from './funcElement.ts'
import DataElement, {getNumericKind} from './dataElement.ts'
import Data from './data.ts'
import FunctionArgument from './functionArgument.ts'
import TypePrototypeRegistry, {type PrototypeMethod} from './typePrototype.ts'
import {initializeCall} from './call/initialize.ts'
import {emitCall as emitCallImpl} from './call/emit.ts'
import {emitConsoleLog as emitConsoleLogImpl} from './call/consoleLog.ts'
import {emitSuperCall as emitSuperCallImpl} from './call/superCall.ts'
import {emitLocalMethodCall as emitLocalMethodCallImpl} from './call/localMethodCall.ts'
import {emitAsyncCall as emitAsyncCallImpl,emitAsyncArgument as emitAsyncArgumentImpl,emitAsyncFailure as emitAsyncFailureImpl} from './call/asyncCall.ts'
import {validateArrayPush as validateArrayPushImpl} from './call/arrayValidation.ts'
import {emitArrayPush as emitArrayPushImpl} from './call/arrayPush.ts'
import {emitArrayForEach as emitArrayForEachImpl} from './call/arrayForEach.ts'
import {emitArrayToString as emitArrayToStringImpl} from './call/arrayToString.ts'
import {emitArrayBufferToString as emitArrayBufferToStringImpl} from './call/arrayBufferToString.ts'
import {emitStringCharCodeAt as emitStringCharCodeAtImpl} from './call/stringCharCodeAt.ts'
import {emitStringSplit as emitStringSplitImpl} from './call/stringSplit.ts'
import {emitStringReplace as emitStringReplaceImpl} from './call/stringReplace.ts'
import {emitStringSearch as emitStringSearchImpl} from './call/stringSearch.ts'
import {emitStringRange as emitStringRangeImpl} from './call/stringRange.ts'
import {emitStringConcat as emitStringConcatImpl} from './call/stringConcat.ts'
import {emitStringTransform as emitStringTransformImpl} from './call/stringTransform.ts'
import {emitPromiseMethod as emitPromiseMethodImpl} from './call/promise.ts'
import {getMethod as getMethodImpl,getPrototypeMethod as getPrototypeMethodImpl} from './call/methodLookup.ts'

let returnedClassId = 0

export class Call extends Base{
    func:FuncElement|null = null
    resultTarget:DataElement|null = null
    params:FunctionArgument[] = []
    methodInstance:DataElement|null = null
    arrayMethodArray:DataElement|null = null
    arrayMethodIndex:FunctionArgument|null = null
    builtinArray:DataElement|null = null
    builtinArrayForEach:DataElement|null = null
    builtinArrayToString:DataElement|null = null
    builtinArrayBufferToString:DataElement|null = null
    builtinStringCharCodeAt:DataElement|null = null
    builtinStringSplit:DataElement|null = null
    builtinStringReplace:DataElement|null = null
    builtinStringReplaceMethod:string|null = null
    builtinStringSearch:DataElement|null = null
    builtinStringSearchMethod:string|null = null
    builtinStringRange:DataElement|null = null
    builtinStringRangeMethod:string|null = null
    builtinStringConcat:DataElement|null = null
    builtinStringTransform:DataElement|null = null
    builtinStringTransformMethod:string|null = null
    builtinPromiseMethod:string|null = null
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
        initializeCall(this,tokenizer)
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
        if(this.resultTarget){
            ASM.addCode(`mov [${this.resultTarget.name}], rax`)
        }
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
    emitStringRange(ASM:Asm){
        emitStringRangeImpl(this,ASM)
    }
    emitStringConcat(ASM:Asm){
        emitStringConcatImpl(this,ASM)
    }
    emitStringTransform(ASM:Asm){
        emitStringTransformImpl(this,ASM)
    }
    emitPromiseMethod(ASM:Asm){
        emitPromiseMethodImpl(this,ASM)
    }
    emitArrayPush(ASM:Asm){
        emitArrayPushImpl(this,ASM)
    }
    emitArrayForEach(ASM:Asm){
        emitArrayForEachImpl(this,ASM)
    }
    emitArrayToString(ASM:Asm){
        emitArrayToStringImpl(this,ASM)
    }
    emitArrayBufferToString(ASM:Asm){
        emitArrayBufferToStringImpl(this,ASM)
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
        const chainedMethod = token.match(/^\.(\w+)$/)
        if(chainedMethod&&tokenizer.tokens[tokenizer.index]==='('){
            const previous = active.children[active.children.length-1]
            if(!(previous instanceof Call)){
                throw new Error('Chained method call requires the previous method to return this')
            }
            let instanceName:string
            if(previous.func?.returnThis&&previous.methodInstance){
                instanceName = previous.methodInstance.name!
            }else{
                const className = previous.func?.returnClassType
                    ??(previous.func?.returnType?active.getClass(previous.func.returnType)?.name:null)
                const classType = className?active.getClass(className):null
                if(!className||!classType?.getFunction(chainedMethod[1])){
                    throw new Error('Chained method call requires the previous method to return this or a class instance')
                }
                let instanceId = ''
                do{
                    instanceId = `__ds_returned_class_${++returnedClassId}`
                }while(active.getData(instanceId))
                const instance = new DataElement('let',instanceId,className,'0')
                instance.classType = className
                instance.isHeapAllocated = true
                instance.isReferenceAlias = true
                let functionScope:Base|null = active
                while(functionScope&&!functionScope.isFunctionScope){
                    functionScope = functionScope.parent
                }
                instance.isProcedureLocal = Boolean(functionScope)
                active.addData(instance)
                const declaration = new Data(active)
                declaration.element = instance
                active.children.push(declaration)
                previous.resultTarget = instance
                instanceName = instanceId
            }
            tokenizer.get()
            const args = tokenizer.getCallArguments()
            const chained = new Call(active)
            const chainedTokenizer = new Tokenizer(
                `${instanceName}.${chainedMethod[1]}(${args.join(',')})`
            )
            chained.set(chainedTokenizer)
            if(chainedTokenizer.has()){
                throw new Error('Invalid chained method call')
            }
            active.children.push(chained)
            return chained
        }
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