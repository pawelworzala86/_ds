import Asm from '../asm.ts'
import {emitExpression} from '../maths.ts'
import {stringLiteralData} from '../stringLiteral.ts'
import Base from './base.ts'
import DataElement, {getNumericKind} from './dataElement.ts'
import FunctionArgument from './functionArgument.ts'
import New from './new.ts'
import Tokenizer from '../tokenizer.ts'
import Timeout from './timeout.ts'
import {splitTopLevelArrayValues} from './data/arrays.ts'

export class PromiseInitializer extends Base{
    target:DataElement
    status:1|2
    value:FunctionArgument|null
    timeout:Timeout|null = null
    allPromises:DataElement[]|null = null

    constructor(parent:Base,target:DataElement,status:1|2,value:FunctionArgument|null){
        super(parent)
        this.target = target
        this.status = status
        this.value = value
    }

    asm(ASM:Asm){
        if(this.allPromises){
            this.emitAll(ASM)
            return
        }
        if(this.timeout){
            const name = this.target.name
            if(!name){
                throw new Error('Promise initializer target is not initialized')
            }
            ASM.addCode(`mov qword [${name}__state], 0`)
            this.timeout.asm(ASM)
            return
        }
        this.emitSettlement(ASM)
    }

    emitSettlement(ASM:Asm){
        const name = this.target.name
        if(!name){
            throw new Error('Promise initializer target is not initialized')
        }
        if(!this.value){
            throw new Error('Promise initializer value is not initialized')
        }
        const value = this.value.value
        if(this.value.expression){
            emitExpression(this.value.expression,ASM)
            if(this.value.expression.numericKind==='float'){
                ASM.addCode('movq rax, xmm0')
            }
        }else if(value instanceof DataElement){
            if(value.isConstAlias){
                ASM.addCode(`mov rax, ${value.name}`)
            }else if(value.isArray){
                ASM.addCode(value.isParameter||value.dynamicArray
                    ? `mov rax, [${value.name}]`
                    : `lea rax, [${value.name}]`)
            }else if(value.classType&&!value.isArray){
                ASM.addCode(value.isParameter
                    ? `mov rax, ${value.name}`
                    : value.isReferenceAlias||value.isHeapAllocated
                        ? `mov rax, [${value.name}]`
                        : `lea rax, [${value.name}]`)
            }else if(value.type==='string'){
                ASM.addCode(value.isParameter
                    ? `mov rax, ${value.name}`
                    : `mov rax, [${value.name}]`)
            }else{
                ASM.addCode(value.isParameter
                    ? `mov rax, ${value.name}`
                    : `mov rax, [${value.name}]`)
            }
        }else if(typeof value==='string'&&/^(['"])[\s\S]*\1$/.test(value)){
            const label = `__ds_promise_string_${name}`
            ASM.addData(`${label} ${stringLiteralData(value)}`)
            ASM.addCode(`lea rax, [${label}]`)
        }else if(value==='true'||value==='false'){
            ASM.addCode(`mov rax, ${value==='true'?1:0}`)
        }else{
            throw new Error('Unsupported Promise value')
        }
        ASM.addCode(`mov [${name}__value], rax`)
        ASM.addCode(`mov qword [${name}__state], ${this.status}`)
    }

    emitAll(ASM:Asm){
        const name = this.target.name
        if(!name){
            throw new Error('Promise.all target is not initialized')
        }
        const values = `${name}__items`
        ASM.addData(`${values} dq ${this.allPromises!.map(()=>0).join(', ')||'0'}`)
        ASM.addImport('kernel32','Sleep')
        const poll = `__ds_promise_all_poll_${name}`
        const wait = `__ds_promise_all_wait_${name}`
        const finish = `__ds_promise_all_finish_${name}`
        ASM.addCode(`${poll}:`)
        for(let index=0;index<this.allPromises!.length;index++){
            const promise = this.allPromises![index]
            if(!promise.name){
                throw new Error('Promise.all contains an uninitialized promise')
            }
            const rejected = `__ds_promise_all_rejected_${name}_${index}`
            ASM.addCode(`cmp qword [${promise.name}__state], 2`)
            ASM.addCode(`je ${rejected}`)
            ASM.addCode(`cmp qword [${promise.name}__state], 1`)
            ASM.addCode(`jne ${wait}`)
        }
        this.allPromises!.forEach((promise,index)=>{
            ASM.addCode(`mov rax, [${promise.name}__value]`)
            ASM.addCode(`mov [${values}+${index*8}], rax`)
        })
        ASM.addCode(`lea rax, [${values}]`)
        ASM.addCode(`mov [${name}__value], rax`)
        ASM.addCode(`mov qword [${name}__state], 1`)
        ASM.addCode(`jmp ${finish}`)
        this.allPromises!.forEach((promise,index)=>{
            const rejected = `__ds_promise_all_rejected_${name}_${index}`
            ASM.addCode(`${rejected}:`)
            ASM.addCode(`mov rax, [${promise.name}__value]`)
            ASM.addCode(`mov [${name}__value], rax`)
            ASM.addCode(`mov qword [${name}__state], 2`)
            ASM.addCode(`jmp ${finish}`)
        })
        ASM.addCode(`${wait}:`)
        ASM.addCode('mov ecx, 1')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [Sleep]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`jmp ${poll}`)
        ASM.addCode(`${finish}:`)
    }

    setTimeout(parent:Base,delay:string){
        this.timeout = new Timeout(parent)
        this.timeout.set(new Tokenizer(`setTimeout(()=>{},${delay})`))
        this.timeout.children.push(new PromiseSettlement(this.timeout,this))
    }
}

class PromiseSettlement extends Base{
    initializer:PromiseInitializer

    constructor(parent:Base,initializer:PromiseInitializer){
        super(parent)
        this.initializer = initializer
    }

    asm(ASM:Asm){
        this.initializer.emitSettlement(ASM)
    }
}

export function getPromiseValueType(type:string|undefined){
    const valueType = type?.match(/^Promise(?:<\s*([a-z_$][\w$]*(?:\[\])?)\s*>)?$/i)?.[1]
    if(!valueType){
        return null
    }
    return ['number','string','boolean'].includes(valueType.toLowerCase())
        ? valueType.toLowerCase()
        : valueType
}

export function isPromiseType(type:string|undefined){
    return Boolean(type?.match(/^Promise(?:<\s*[a-z_$][\w$]*(?:\[\])?\s*>)?$/i))
}

function getValueType(argument:FunctionArgument){
    const value = argument.value
    if(value instanceof DataElement){
        if(value.isArray){
            return `${value.classType??value.type}[]`
        }
        if(value.type==='number'||value.type==='string'||value.type==='boolean'){
            return value.type
        }
        return !value.isArray&&!/^Promise(?:<.*>)?$/i.test(value.type??'')
            ? value.classType??value.type
            : null
    }
    if(typeof value==='string'){
        if(/^(['"])[\s\S]*\1$/.test(value)){
            return 'string'
        }
        if(value==='true'||value==='false'){
            return 'boolean'
        }
        if(argument.expression){
            return 'number'
        }
    }
    return null
}

function getPromiseArgument(parent:Base,expression:string){
    const argument = new FunctionArgument(parent,expression)
    if(typeof argument.value!=='string'||!/^new[a-z_$][\w$]*\([\s\S]*\)$/i.test(expression)){
        return argument
    }
    const previousDataCount = parent.DATA.length
    const tokenizer = new Tokenizer(`${expression.replace(/^new/i,'new ')};`)
    New.test(parent,tokenizer)
    if(tokenizer.has()){
        throw new Error('Invalid Promise class constructor value')
    }
    const instance = parent.DATA.slice(previousDataCount).find(data=>data.classType&&!data.isArray)
    if(!instance?.name){
        throw new Error('Unable to initialize Promise class value')
    }
    return new FunctionArgument(parent,instance.name)
}

export function parsePromiseInitializer(
    parent:Base,
    target:DataElement,
    expression:string,
    declaredType:string|undefined
){
    const all = expression.match(/^Promise\.all\(\[([\s\S]*)\]\)$/)
    if(all){
        const promises = splitTopLevelArrayValues(all[1]).map(name=>{
            if(!/^[a-z_$][\w$]*$/i.test(name)){
                throw new Error('Promise.all only supports an array of Promise<T> variables')
            }
            const promise = parent.getData(name)
            if(!promise||!getPromiseValueTypeFromData(promise)){
                throw new Error(`Promise.all expects Promise<T> values, received "${name}"`)
            }
            return promise
        })
        if(!promises.length){
            throw new Error('Promise.all requires at least one typed promise')
        }
        const itemType = getPromiseValueTypeFromData(promises[0])!
        if(promises.some(promise=>getPromiseValueTypeFromData(promise)!==itemType)){
            throw new Error('Promise.all values must have the same type')
        }
        const valueType = `${itemType}[]`
        const declaredValueType = getPromiseValueType(declaredType)
        if(declaredType&&!declaredValueType){
            throw new Error(`Promise.all cannot be assigned to "${declaredType}"`)
        }
        if(declaredValueType&&declaredValueType!==valueType){
            throw new Error(`Promise.all value type "${valueType}" does not match "${declaredValueType}"`)
        }
        target.type = `Promise<${declaredValueType??valueType}>`
        target.value = '0'
        target.arrayLength = promises.length
        const elementType = itemType.replace(/\[\]$/,'')
        if(!['number','string','boolean'].includes(elementType)){
            target.classType = elementType
        }
        const initializer = new PromiseInitializer(parent,target,1,null)
        initializer.allPromises = promises
        return initializer
    }
    let status:1|2
    let valueExpression:string
    let timeoutDelay:string|null = null
    const staticCall = expression.match(/^Promise\.(resolve|reject)\(([\s\S]*)\)$/)
    if(staticCall){
        status = staticCall[1]==='resolve'?1:2
        valueExpression = staticCall[2]
    }else{
        const constructor = expression.match(/^newPromise\(\(([^)]*)\)=>\{([\s\S]*)\}\)$/)
        if(!constructor){
            if(expression.startsWith('newPromise(')){
                throw new Error('Promise executor must synchronously call resolve(value) or reject(value)')
            }
            return null
        }
        const parameters = constructor[1].split(',').map(value=>value.trim())
        if(parameters.length<1||parameters.length>2
            ||parameters.some(name=>!/^[a-z_$][\w$]*$/i.test(name))){
            throw new Error('Promise executor must accept resolve and optional reject callbacks')
        }
        const executorBody = constructor[2].trim()
        const timer = executorBody.match(/^setTimeout\(\(\)=>\{([\s\S]*)\},([\s\S]*)\)$/)
        let resolution:string[]|null
        if(timer){
            timeoutDelay = timer[2].trim()
            resolution = timer[1].trim().match(/^([a-z_$][\w$]*)\(([\s\S]*)\);?$/i)
        }else{
            resolution = executorBody.match(/^([a-z_$][\w$]*)\(([\s\S]*)\);?$/i)
        }
        if(!resolution){
            throw new Error('Promise executor must directly resolve/reject or use setTimeout to resolve/reject')
        }
        const resolveName = parameters[0]
        const rejectName = parameters[1]
        if(resolution[1]===resolveName){
            status = 1
        }else if(rejectName&&resolution[1]===rejectName){
            status = 2
        }else{
            throw new Error('Promise executor called an unknown resolver')
        }
        valueExpression = resolution[2]
    }
    const argument = getPromiseArgument(parent,valueExpression)
    const valueType = getValueType(argument)
    const argumentValue = argument.value
    if(!valueType){
        throw new Error('Promise values must have a supported scalar or class type')
    }
    const declaredValueType = getPromiseValueType(declaredType)
    if(declaredType&&!declaredValueType){
        throw new Error(`Promise initializer cannot be assigned to "${declaredType}"`)
    }
    if(declaredValueType&&declaredValueType!==valueType){
        throw new Error(`Promise value type "${valueType}" does not match "${declaredValueType}"`)
    }
    target.type = `Promise<${declaredValueType??valueType}>`
    if(argumentValue instanceof DataElement&&argumentValue.isArray){
        target.arrayLength = argumentValue.arrayLength
    }
    if(valueType==='number'){
        target.numericKind = argument.expression?.numericKind
            ??(argumentValue instanceof DataElement
                ? argumentValue.numericKind
                : typeof argumentValue==='string'?getNumericKind(argumentValue):'integer')
    }
    target.value = '0'
    const initializer = new PromiseInitializer(parent,target,status,argument)
    if(timeoutDelay){
        initializer.setTimeout(parent,timeoutDelay)
    }
    return initializer
}

export function getPromiseValueTypeFromData(data:DataElement){
    return getPromiseValueType(data.type??undefined)
}

export default PromiseInitializer
