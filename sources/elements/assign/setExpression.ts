import Tokenizer from '../../tokenizer.ts'
import DataElement from '../dataElement.ts'
import {isMathFunction, parseExpression, type Expression} from '../../maths.ts'
import {getClassPropertyAccess, getClassPropertyOffset} from '../clasElement.ts'
import Invoke, {isInvoke} from '../invoke.ts'
import FuncElement from '../funcElement.ts'
import Call from '../call.ts'
import {getPromiseValueTypeFromData} from '../promise.ts'
import Timeout from '../timeout.ts'
import type {Assign} from '../assign.ts'

let callbackId = 0

export function setExpression(assignment:Assign,target:DataElement,expression:string,initializer=false,indexText?:string,append=false){
    const isStringArray = target.isArray && (target.type==='string'||target.type==='string[]')
    if(!initializer&&target.kind==='const'){
        throw new Error(`Cannot assign to constant "${target.name}"`)
    }
    const promiseAwait = expression.trim().match(/^await\s+([a-z_$][\w$]*)$/i)
    if(promiseAwait){
        const promise = assignment.parent?.getData(promiseAwait[1])
        const valueType = promise?getPromiseValueTypeFromData(promise):null
        if(!promise||!valueType){
            throw new Error('Await expects a Promise<T> variable')
        }
        if(target.type!==valueType||target.isArray){
            throw new Error(`Awaited Promise value type "${valueType}" does not match "${target.type}"`)
        }
        assignment.target = target
        assignment.promiseAwait = promise
        if(valueType==='number'){
            target.numericKind = promise.numericKind
        }
        return
    }
    if(target.type==='boolean'&&!target.isArray){
        const value = expression.trim()
        if(value==='true'||value==='false'){
            assignment.target = target
            assignment.expression = parseExpression(value,assignment.parent!)
            return
        }
        const source = assignment.parent?.getData(value)
        const sourceAccess = assignment.parent?getClassPropertyAccess(assignment.parent,value):null
        if(source?.type==='boolean'&&!source.isArray
            ||sourceAccess?.property.type==='boolean'&&!sourceAccess.property.isArray){
            assignment.target = target
            assignment.expression = parseExpression(value,assignment.parent!)
            return
        }
        if(/^[a-z_$][\w.$]*\([\s\S]*\)$/i.test(value)){
            const call = new Call(assignment.parent!)
            const tokenizer = new Tokenizer(value)
            call.set(tokenizer)
            if(!tokenizer.has()
                &&call.builtinStringSearchMethod
                &&call.builtinStringSearchMethod!=='indexOf'){
                assignment.target = target
                assignment.functionCall = call
                return
            }
        }
        throw new Error(`Boolean "${target.name}" can only be assigned a boolean value`)
    }
    if(target.isArray&&!indexText){
        const callSyntax = expression.trim().match(/^[a-z_$][\w.$]*\([\s\S]*\)$/i)
        if(callSyntax){
            const tokenizer = new Tokenizer(expression.trim())
            const call = new Call(assignment.parent!)
            call.set(tokenizer)
            if(!tokenizer.has()
                &&target.dynamicArray
                &&!target.classPropertyInstance
                &&call.func?.returnArrayType===`${target.type}[]`
                &&!call.func.isAsync
                &&!call.methodInstance
                &&!call.prototypeMethod){
                assignment.target = target
                assignment.arrayCall = call
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
        assignment.target = target
        assignment.stringAppend = append
        const value = expression.trim()
        if(!append&&/^[a-z_$][\w.$]*\([\s\S]*\)$/i.test(value)){
            const tokenizer = new Tokenizer(value)
            const call = new Call(assignment.parent!)
            call.set(tokenizer)
            if(!tokenizer.has()&&(
                call.builtinStringReplace
                ||call.builtinStringRange
                ||call.builtinStringConcat
            )){
                assignment.stringCall = call
                return
            }
        }
        const stringLiteral = value.match(/^(['"])(?:\\.|(?!\1).)*\1$/s)
        if(stringLiteral){
            assignment.stringValue = value
            return
        }
        const source = assignment.parent?.getData(value)
        if(source&&source.type==='string'&&!source.isArray){
            assignment.stringSource = source
            return
        }
        throw new Error(`String assignment requires a string literal or string variable: "${expression}"`)
    }
    if((target.type==='string'||target.type==='string[]')&&(!target.isArray||!indexText)){
        throw new Error('String assignment is only supported for string array elements')
    }
    if((target.type!=='number'&&target.type!=='boolean'&&target.type!=='Function'&&target.type!=='function'&&target.type!=='ArrayBuffer'&&!target.isArray)&&(target.type!=='string'&&target.type!=='string[]')){
        throw new Error('Assignment is only supported for number and function variables and string array elements')
    }
    assignment.target = target
    if(isStringArray){
        const value = expression.trim()
        const stringLiteral = value.match(/^(['"])(?:\\.|(?!\1).)*\1$/s)
        if(stringLiteral){
            assignment.stringValue = value
            if(indexText){
                assignment.targetIndex = parseExpression(indexText,assignment.parent!)
                if(assignment.targetIndex.numericKind!=='integer'){
                    throw new Error('Array index must be an integer')
                }
            }
            return
        }
        const arrayMember = value.match(/^([a-z_$][\w.$]*)\[([^\]]+)\]$/i)
        if(arrayMember){
            const source = assignment.parent?.getData(arrayMember[1])
            if(source&&source.isArray&&(source.type==='string'||source.type==='string[]')){
                assignment.stringSource = source
                assignment.stringSourceIndex = parseExpression(arrayMember[2],assignment.parent!)
                if(assignment.stringSourceIndex.numericKind!=='integer'){
                    throw new Error('Array index must be an integer')
                }
                if(indexText){
                    assignment.targetIndex = parseExpression(indexText,assignment.parent!)
                    if(assignment.targetIndex.numericKind!=='integer'){
                        throw new Error('Array index must be an integer')
                    }
                }
                return
            }
        }
        const source = assignment.parent?.getData(value)
        if(source&&source.type==='string'&&!source.isArray){
            assignment.stringSource = source
            if(indexText){
                assignment.targetIndex = parseExpression(indexText,assignment.parent!)
                if(assignment.targetIndex.numericKind!=='integer'){
                    throw new Error('Array index must be an integer')
                }
            }
            return
        }
        throw new Error(`String array assignment requires a string literal, string variable, or string-array element: "${expression}"`)
    }
    const address = !indexText?expression.trim().match(/^&([a-z_$][\w.$]*)$/i):null
    if(address){
        assignment.addressLabel = address[1]
        assignment.addressFunction = assignment.parent?.getFunction(address[1])??null
        if(assignment.addressFunction&&!assignment.addressFunction.nativeCallbackName){
            assignment.addressFunction.nativeCallbackName = `__ds_native_callback_${++callbackId}`
        }
        return
    }
    const nativeCall = !indexText?expression.trim().match(/^([a-z_$][\w$]*(?:\.[a-z_$][\w$]*)*)\(([\s\S]*)\)$/i):null
    if(nativeCall&&isInvoke(nativeCall[1])&&!isMathFunction(nativeCall[1])){
        assignment.invokeExpression = new Invoke(assignment.parent!)
        assignment.invokeExpression.set(new Tokenizer(expression.trim()))
        target.numericKind = 'integer'
        return
    }
    if(nativeCall&&!isMathFunction(nativeCall[1])){
        const call = new Call(assignment.parent!)
        const tokenizer = new Tokenizer(expression.trim())
        call.set(tokenizer)
        if(!tokenizer.has()&&(call.func||call.functionVariable)&&!call.func?.isAsync&&!call.prototypeMethod){
            assignment.functionCall = call
            target.numericKind = 'integer'
            return
        }
    }
    assignment.expression = parseExpression(expression,assignment.parent!)
    if(indexText){
        assignment.targetIndex = parseExpression(indexText,assignment.parent!)
        if(assignment.targetIndex.numericKind!=='integer'){
            throw new Error('Array index must be an integer')
        }
    }
    target.numericKind = target.numericKind==='float'||assignment.expression.numericKind==='float'
        ? 'float'
        : 'integer'
}
