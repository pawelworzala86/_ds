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
    if(!initializer&&target.kind==='const'&&!indexText){
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
                &&(call.builtinStringSearchMethod&&call.builtinStringSearchMethod!=='indexOf'
                    ||call.func?.returnType==='boolean')){
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
    if(target.isArray&&indexText&&(target.classType||target.type==='any')){
        const index = parseExpression(indexText,assignment.parent!)
        if(index.numericKind!=='integer'){
            throw new Error('Array index must be an integer')
        }
        const value = expression.trim()
        const constructor = value.match(/^new\s*([a-z_$][\w$]*)\s*\(([\s\S]*)\)$/i)
        if(constructor){
            if(target.classType&&constructor[1]!==target.classType){
                throw new Error(`Array "${target.name}" requires an instance of ${target.classType}`)
            }
            const classType = assignment.parent?.getClass(constructor[1])
            if(!classType){
                throw new Error(`Unknown class type "${constructor[1]}"`)
            }
            const argsTokenizer = new Tokenizer(`(${constructor[2]})`)
            argsTokenizer.get()
            const args = argsTokenizer.getCallArguments()
            if(argsTokenizer.has()){
                throw new Error(`Invalid constructor initializer for array "${target.name}"`)
            }
            const classConstructor = classType.getFunction('constructor')
            if(args.length!==(classConstructor?.params.length??0)){
                throw new Error(`Constructor for "${constructor[1]}" expects ${classConstructor?.params.length??0} arguments, received ${args.length}`)
            }
            if(args.length){
                throw new Error('Array element constructors with arguments are not supported')
            }
            assignment.target = target
            assignment.targetIndex = index
            assignment.arrayClassType = constructor[1]
            const staticIndex = index.kind==='number'
                ? Number(index.value)
                : index.kind==='data'&&index.value.isConstAlias
                    ? Number(index.value.value)
                    : null
            if(target.type==='any'&&staticIndex!==null){
                target.arrayElementTypes.set(staticIndex,{type:constructor[1],classType:constructor[1],numericKind:'integer'})
            }
            return
        }
        const source = assignment.parent?.getData(value)
        if(source?.classType&&(!target.classType||source.classType===target.classType)&&!source.isArray){
            assignment.target = target
            assignment.targetIndex = index
            assignment.arrayClassValue = source
            assignment.arrayClassType = source.classType
            const staticIndex = index.kind==='number'
                ? Number(index.value)
                : index.kind==='data'&&index.value.isConstAlias
                    ? Number(index.value.value)
                    : null
            if(target.type==='any'&&staticIndex!==null){
                target.arrayElementTypes.set(staticIndex,{type:source.classType,classType:source.classType,numericKind:'integer'})
            }
            return
        }
        if(target.classType){
            throw new Error(`Array "${target.name}" requires an instance of ${target.classType}`)
        }
    }
    if(target.isArray&&target.type==='any'&&indexText){
        const index = parseExpression(indexText,assignment.parent!)
        if(index.numericKind!=='integer'){
            throw new Error('Array index must be an integer')
        }
        const staticIndex = index.kind==='number'
            ? Number(index.value)
            : index.kind==='data'&&index.value.isConstAlias
                ? Number(index.value.value)
                : null
        const value = expression.trim()
        const stringLiteral = value.match(/^(['"])(?:\\.|(?!\1).)*\1$/s)
        if(stringLiteral){
            assignment.target = target
            assignment.targetIndex = index
            assignment.stringValue = value
            if(staticIndex!==null){
                target.arrayElementTypes.set(staticIndex,{type:'string',classType:null,numericKind:'integer'})
            }
            return
        }
        const source = assignment.parent?.getData(value)
        if(source?.type==='string'&&!source.isArray){
            assignment.target = target
            assignment.targetIndex = index
            assignment.stringSource = source
            if(staticIndex!==null){
                target.arrayElementTypes.set(staticIndex,{type:'string',classType:null,numericKind:'integer'})
            }
            return
        }
        const booleanSource = value==='true'||value==='false'
            ? true
            : source?.type==='boolean'&&!source.isArray
        if(staticIndex!==null){
            target.arrayElementTypes.set(staticIndex,{
                type:booleanSource?'boolean':'number',
                classType:null,
                numericKind:'integer'
            })
        }
    }
    if(target.classType&&!target.isArray&&!indexText){
        const classInitializer = expression.trim().match(/^new([a-z_$][\w$]*)\(([\s\S]*)\)$/i)
        if(classInitializer){
            const [,className,argsText] = classInitializer
            if(className!==target.classType){
                throw new Error(`Class instance "${target.name}" requires new ${target.classType}()`)
            }
            const classType = assignment.parent?.getClass(className)
            if(!classType){
                throw new Error(`Unknown class type "${className}"`)
            }
            const argsTokenizer = new Tokenizer(`(${argsText})`)
            argsTokenizer.get()
            const args = argsTokenizer.getCallArguments()
            if(argsTokenizer.has()){
                throw new Error(`Invalid constructor initializer for class instance "${target.name}"`)
            }
            const constructor = classType.getFunction('constructor')
            if(!constructor&&args.length){
                throw new Error(`Class "${className}" has no constructor`)
            }
            assignment.target = target
            if(constructor){
                const call = new Call(assignment.parent!)
                call.func = constructor
                call.methodInstance = target
                call.set(new Tokenizer(`${target.name}.constructor(${args.join(',')})`))
                assignment.classInitializerCall = call
            }else{
                assignment.classInitializerNoop = true
            }
            return
        }
    }
    if(target.classType&&!target.isArray&&!indexText&&target.classPropertyInstance){
        const source = assignment.parent?.getData(expression.trim())
        if(source?.classType===target.classType&&!source.isArray){
            assignment.target = target
            assignment.classValue = source
            return
        }
        throw new Error(`Class property "${target.name}" requires an instance of ${target.classType}`)
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
                ||call.builtinStringTransform
                ||call.func?.returnType==='string'
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
        if(!tokenizer.has()
            &&(call.func||call.functionVariable||call.builtinStringCharCodeAt)
            &&!call.func?.isAsync
            &&!call.prototypeMethod){
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
    if(!(target.isArray&&target.type==='any')){
        target.numericKind = target.numericKind==='float'||assignment.expression.numericKind==='float'
            ? 'float'
            : 'integer'
    }
    if(target.isArray&&target.type==='any'&&indexText){
        const index = assignment.targetIndex
        const staticIndex = index?.kind==='number'
            ? Number(index.value)
            : index?.kind==='data'&&index.value.isConstAlias
                ? Number(index.value.value)
                : null
        if(staticIndex!==null){
            target.arrayElementTypes.set(staticIndex,{
                type:expression.trim()==='true'||expression.trim()==='false'?'boolean':'number',
                classType:null,
                numericKind:assignment.expression.numericKind
            })
        }
    }
}
