import Asm from '../asm.ts'
import {emitExpression} from '../maths.ts'
import {stringLiteralData} from '../stringLiteral.ts'
import Base from './base.ts'
import DataElement from './dataElement.ts'
import FunctionArgument from './functionArgument.ts'

export class PromiseInitializer extends Base{
    target:DataElement
    status:1|2
    value:FunctionArgument

    constructor(parent:Base,target:DataElement,status:1|2,value:FunctionArgument){
        super(parent)
        this.target = target
        this.status = status
        this.value = value
    }

    asm(ASM:Asm){
        const name = this.target.name
        if(!name){
            throw new Error('Promise initializer target is not initialized')
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
}

function getPromiseValueType(type:string|undefined){
    return type?.match(/^Promise(?:<\s*(number|string|boolean)\s*>)?$/i)?.[1]?.toLowerCase()??null
}

function getValueType(argument:FunctionArgument){
    const value = argument.value
    if(value instanceof DataElement){
        return value.type==='number'||value.type==='string'||value.type==='boolean'
            ? value.type
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

export function parsePromiseInitializer(
    parent:Base,
    target:DataElement,
    expression:string,
    declaredType:string|undefined
){
    let status:1|2
    let valueExpression:string
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
        const resolution = constructor[2].trim().match(/^([a-z_$][\w$]*)\(([\s\S]*)\);?$/i)
        if(!resolution){
            throw new Error('Promise executor only supports a direct resolve(value) or reject(value) call')
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
    const argument = new FunctionArgument(parent,valueExpression)
    const valueType = getValueType(argument)
    if(!valueType){
        throw new Error('Promise values must be number, string, or boolean')
    }
    const declaredValueType = getPromiseValueType(declaredType)
    if(declaredType&&!declaredValueType){
        throw new Error(`Promise initializer cannot be assigned to "${declaredType}"`)
    }
    if(declaredValueType&&declaredValueType!==valueType){
        throw new Error(`Promise value type "${valueType}" does not match "${declaredValueType}"`)
    }
    target.type = `Promise<${declaredValueType??valueType}>`
    target.value = '0'
    return new PromiseInitializer(parent,target,status,argument)
}

export function getPromiseValueTypeFromData(data:DataElement){
    return getPromiseValueType(data.type??undefined)
}

export default PromiseInitializer
