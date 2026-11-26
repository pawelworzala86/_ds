import Tokenizer from '../../tokenizer.ts'
import DataElement from '../dataElement.ts'
import FunctionArgument from '../functionArgument.ts'
import FuncElement from '../funcElement.ts'
import {createInlineCallback} from '../func.ts'
import {parseRegExpLiteral} from '../../regex.ts'
import Call from '../call.ts'
import {getPromiseValueTypeFromData} from '../promise.ts'
import Data from '../data.ts'

let arrayPushId = 0
let arrayToStringArgumentId = 0
let stringCharCodeAtId = 0
let defaultClassArgumentId = 0

export function initializeCall(instance:Call,tokenizer:Tokenizer){
    const name = tokenizer.get()
    instance.callName = name
    instance.builtinConsoleLog = name==='console.log'
    if(tokenizer.get()!=='('){
        throw new Error(`Expected '(' after function "${name}"`)
    }
    const superCall = name==='super'||name.startsWith('super.')
    instance.superCall = superCall
    let superInstance:DataElement|null = null
    if(superCall){
        const parentClass = instance.classElement?.parentClass
        if(!parentClass){
            throw new Error('Cannot call super without a parent class')
        }
        const methodName = name==='super'?'constructor':name.slice('super.'.length)
        instance.func = parentClass.getFunction(methodName)
        if(!instance.func){
            if(methodName!=='constructor'){
                throw new Error(`Unknown parent method "${methodName}"`)
            }
            instance.noOp = true
        }else{
            superInstance = new DataElement('let','this',parentClass.name??'','0')
            superInstance.classType = parentClass.name
            superInstance.isProcedureLocal = true
            instance.methodInstance = superInstance
        }
    }
    const method = Call.getMethod(instance,name)
    const prototype = Call.getPrototypeMethod(instance,name)
    const variable = instance.getData(name)
    instance.func ??= method?.func??(prototype?.method.kind==='function'?prototype.method.func:null)??instance.getFunction(name)
    instance.methodInstance ??= method?.instance??null
    if(method?.arrayMethod){
        instance.arrayMethodArray = method.arrayMethod.array
        instance.arrayMethodIndex = new FunctionArgument(instance,method.arrayMethod.index)
        const indexNumericKind = instance.arrayMethodIndex.expression?.numericKind
            ??(instance.arrayMethodIndex.value instanceof DataElement?instance.arrayMethodIndex.value.numericKind:'integer')
        if(indexNumericKind!=='integer'){
            throw new Error('Array index must be an integer')
        }
    }
    instance.functionVariable = variable && (variable.type==='Function'||variable.type==='function') ? variable : null
    instance.prototypeMethod = prototype?.method.kind==='function'
    instance.prototypeReceiver = instance.prototypeMethod&&Boolean(prototype&&!prototype.type.startsWith('class:'))
    instance.builtinArray = prototype?.method.kind==='builtin'&&prototype.method.name==='push'
        ? prototype.instance
        : null
    instance.builtinArrayForEach = prototype?.method.kind==='builtin'&&prototype.method.name==='forEach'
        ? prototype.instance
        : null
    instance.builtinArrayToString = prototype?.method.kind==='builtin'
        &&prototype.method.name==='toString'
        &&prototype.type==='array'
        ? prototype.instance
        : null
    instance.builtinArrayBufferToString = prototype?.method.kind==='builtin'
        &&prototype.method.name==='toString'
        &&prototype.type==='ArrayBuffer'
        ? prototype.instance
        : null
    instance.builtinStringCharCodeAt = prototype?.method.kind==='builtin'&&prototype.method.name==='charCodeAt'
        ? prototype.instance
        : null
    instance.builtinStringSplit = prototype?.method.kind==='builtin'&&prototype.method.name==='split'
        ? prototype.instance
        : null
    instance.builtinStringReplaceMethod = prototype?.method.kind==='builtin'
        &&['replace','replaceAll'].includes(prototype.method.name)
        ? prototype.method.name
        : null
    instance.builtinStringReplace = instance.builtinStringReplaceMethod?prototype!.instance:null
    const stringSearchMethods = ['indexOf','includes','startsWith','endsWith']
    instance.builtinStringSearchMethod = prototype?.method.kind==='builtin'
        &&stringSearchMethods.includes(prototype.method.name)
        ? prototype.method.name
        : null
    instance.builtinStringSearch = instance.builtinStringSearchMethod?prototype!.instance:null
    const stringRangeMethods = ['substring','slice']
    instance.builtinStringRangeMethod = prototype?.method.kind==='builtin'
        &&stringRangeMethods.includes(prototype.method.name)
        ? prototype.method.name
        : null
    instance.builtinStringRange = instance.builtinStringRangeMethod?prototype!.instance:null
    instance.builtinStringConcat = prototype?.method.kind==='builtin'&&prototype.method.name==='concat'
        ? prototype.instance
        : null
    const stringTransformMethods = [
        'toUpperCase',
        'toLowerCase',
        'toLocaleUpperCase',
        'toLocaleLowerCase',
        'trim',
        'trimStart',
        'trimEnd',
        'repeat'
    ]
    instance.builtinStringTransformMethod = prototype?.method.kind==='builtin'
        &&stringTransformMethods.includes(prototype.method.name)
        ? prototype.method.name
        : null
    instance.builtinStringTransform = instance.builtinStringTransformMethod?prototype!.instance:null
    instance.builtinPromiseMethod = prototype?.method.kind==='builtin'
        &&/^Promise(?:<.*>)?$/i.test(prototype.type)
        ? prototype.method.name
        : null
    if(instance.builtinPromiseMethod){
        instance.methodInstance ??= prototype?.instance??null
    }
    if(instance.builtinStringSplit){
        const split = new FuncElement('__ds_string_split',[])
        split.returnArrayType = 'string[]'
        instance.func = split
    }
    if(instance.builtinStringReplace){
        instance.func = new FuncElement(`__ds_string_${instance.builtinStringReplaceMethod}`,[])
    }
    if(instance.builtinStringSearch){
        instance.func = new FuncElement(`__ds_string_${instance.builtinStringSearchMethod}`,[])
    }
    if(instance.builtinStringRange){
        instance.func = new FuncElement(`__ds_string_${instance.builtinStringRangeMethod}`,[])
    }
    if(instance.builtinStringConcat){
        instance.func = new FuncElement('__ds_string_concat',[])
    }
    if(instance.builtinStringTransform){
        instance.func = new FuncElement('__ds_string_transform',[])
    }
    const argumentTexts = tokenizer.getCallArguments()
    const prototypeReceiverOffset = instance.prototypeReceiver?1:0
    const argumentLimit = instance.func
        ? instance.func.params.length-prototypeReceiverOffset
        : 0
    if(instance.func&&argumentTexts.length>argumentLimit){
        throw new Error(`Function "${instance.func.name}" expects at most ${argumentLimit} arguments, received ${argumentTexts.length}`)
    }
    if(instance.func){
        for(let index=argumentTexts.length+prototypeReceiverOffset;index<instance.func.params.length;index++){
            const parameter = instance.func.params[index]
            if(parameter.defaultValue===undefined){
                throw new Error(`Function "${instance.func.name}" requires argument "${parameter.name}"`)
            }
            const classDefault = parameter.defaultValue.match(/^new\s*([a-z_$][\w$]*)\s*\(([\s\S]*)\)$/i)
            if(!classDefault){
                argumentTexts.push(parameter.defaultValue)
                continue
            }
            const className = classDefault[1]
            if(parameter.type!==className){
                throw new Error(`Default value for "${parameter.name}" must be an instance of ${parameter.type}`)
            }
            const classType = instance.getClass(className)
            if(!classType){
                throw new Error(`Unknown class "${className}" in default value for "${parameter.name}"`)
            }
            const constructorArguments = new Tokenizer(`(${classDefault[2]})`)
            constructorArguments.get()
            const args = constructorArguments.getCallArguments()
            const constructor = classType.getFunction('constructor')
            if(args.length&& !constructor){
                throw new Error(`Class "${className}" has no constructor`)
            }
            if(constructor&&args.length>constructor.params.length){
                throw new Error(`Constructor for "${className}" expects at most ${constructor.params.length} arguments, received ${args.length}`)
            }
            const name = `__ds_default_class_argument_${++defaultClassArgumentId}`
            const element = new DataElement('let',name,className,'0')
            element.classType = className
            let functionScope = instance.parent
            while(functionScope&&!functionScope.isFunctionScope){
                functionScope = functionScope.parent
            }
            element.isProcedureLocal = Boolean(functionScope)
            instance.addData(element)
            const declaration = new Data(instance)
            declaration.element = element
            let call:Call|null = null
            if(constructor){
                call = new Call(instance)
                call.set(new Tokenizer(`${name}.constructor(${args.join(',')})`))
            }
            instance.defaultInitializers.push({declaration,call})
            argumentTexts.push(name)
        }
    }
    const template = instance.builtinConsoleLog&&argumentTexts.length===1
        ? argumentTexts[0].match(/^`([\s\S]*)`$/)
        : null
    if(template){
        const content = template[1]
        const pattern = /\$\{([^{}]+)\}/g
        let lastIndex = 0
        let match:RegExpExecArray|null
        instance.consoleTemplateParts = []
        while((match=pattern.exec(content))){
            if(match.index>lastIndex){
                instance.consoleTemplateParts.push({
                    text:content.slice(lastIndex,match.index).replace(/\\`/g,'`').replace(/\\\\/g,'\\'),
                    argument:null
                })
            }
            const argument = new FunctionArgument(instance,match[1].trim())
            instance.params.push(argument)
            instance.consoleTemplateParts.push({text:'',argument})
            lastIndex = pattern.lastIndex
        }
        if(lastIndex<content.length){
            instance.consoleTemplateParts.push({
                text:content.slice(lastIndex).replace(/\\`/g,'`').replace(/\\\\/g,'\\'),
                argument:null
            })
        }
    }else{
        instance.params = argumentTexts.map(token=>new FunctionArgument(instance,token))
    }
    if(instance.builtinPromiseMethod||instance.builtinArrayForEach){
        const array = instance.builtinArrayForEach
        const callbackType = instance.builtinPromiseMethod
            ? getPromiseValueTypeFromData(instance.methodInstance!)
            : array?.classType??array?.type??null
        if(callbackType){
            const callback = createInlineCallback(
                instance.parent!,
                argumentTexts[0]??'',
                callbackType,
                instance.builtinPromiseMethod?instance.methodInstance!.arrayLength:null
            )
            if(callback){
                instance.params[0].value = callback
            }
        }
    }
    if(!template)instance.params.forEach((param,index)=>{
        const argument = argumentTexts[index]
        const arrayToString = argument.match(/^([a-z_$][\w$]*)\.toString\(\)$/i)
        const toStringReceiver = arrayToString?instance.getData(arrayToString[1].split('.')[0]):null
        if(arrayToString&&(toStringReceiver?.isArray||toStringReceiver?.type==='ArrayBuffer')){
            const nestedTokenizer = new Tokenizer(argument)
            const nestedCall = new Call(instance)
            nestedCall.set(nestedTokenizer)
            const isArrayToString = Boolean(toStringReceiver?.isArray&&nestedCall.builtinArrayToString)
            const isArrayBufferToString = Boolean(
                toStringReceiver?.type==='ArrayBuffer'&&nestedCall.builtinArrayBufferToString
            )
            if(nestedTokenizer.has()||!isArrayToString&&!isArrayBufferToString){
                throw new Error('Unable to resolve toString call')
            }
            param.tempName = `__ds_array_to_string_arg_${++arrayToStringArgumentId}`
            param.value = new DataElement('let',param.tempName,'string','0')
            instance.nestedArgumentCalls.set(param,nestedCall)
            return
        }
        if(!/^[a-z_$][\w$]*\.charCodeAt\([\s\S]*\)$/i.test(argument)){
            return
        }
        const nestedTokenizer = new Tokenizer(argument)
        const nestedCall = new Call(instance)
        nestedCall.set(nestedTokenizer)
        if(nestedTokenizer.has()||!nestedCall.builtinStringCharCodeAt){
            throw new Error('charCodeAt is only supported for strings')
        }
        param.tempName = `__ds_string_char_code_at_${++stringCharCodeAtId}`
        instance.nestedArgumentCalls.set(param,nestedCall)
    })
    if(instance.builtinStringCharCodeAt){
        if(instance.params.length!==1){
            throw new Error('String.charCodeAt expects exactly one argument')
        }
        const index = instance.params[0]
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
    if(instance.builtinPromiseMethod){
        const promiseType = getPromiseValueTypeFromData(instance.methodInstance!)
        if(!promiseType){
            throw new Error('Promise methods require a typed Promise<T>')
        }
        if(instance.params.length!==1){
            throw new Error(`Promise.${instance.builtinPromiseMethod} expects exactly one callback`)
        }
        const callback = instance.params[0].value
        if(!(callback instanceof FuncElement)){
            throw new Error(`Promise.${instance.builtinPromiseMethod} only supports named callback functions`)
        }
        if(callback.isAsync||callback.params.length!==1||callback.params[0].type!==promiseType){
            throw new Error(`Promise.${instance.builtinPromiseMethod} callback must accept one ${promiseType} argument`)
        }
    }
    if(instance.builtinArrayForEach){
        const array = instance.builtinArrayForEach
        if(!array.isArray){
            throw new Error('Array.forEach can only be called on an array')
        }
        if(instance.params.length!==1){
            throw new Error('Array.forEach expects exactly one callback')
        }
        const callback = instance.params[0].value
        const itemType = array.classType??array.type
        if(!(callback instanceof FuncElement)){
            throw new Error('Array.forEach only supports named or block-bodied arrow callbacks')
        }
        if(callback.isAsync||callback.params.length!==1||callback.params[0].type!==itemType){
            throw new Error(`Array.forEach callback must accept one ${itemType} argument`)
        }
    }
    if(instance.builtinStringSplit){
        if(instance.params.length!==1){
            throw new Error('String.split expects exactly one separator')
        }
        const separator = instance.params[0]
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
    if(instance.builtinStringReplace){
        if(instance.params.length!==2){
            throw new Error('String.replace expects exactly two arguments')
        }
        const search = instance.params[0]
        const replacement = instance.params[1]
        const isString = (argument:FunctionArgument)=>typeof argument.value==='string'
            &&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(argument.value)
            ||argument.value instanceof DataElement&&argument.value.type==='string'&&!argument.value.isArray
            ||argument.classProperty?.type==='string'&&!argument.classProperty.isArray
        const regexp = typeof search.value==='string'
            ? parseRegExpLiteral(search.value)
            : null
        const isRegExpLiteral = Boolean(regexp)
        if(instance.builtinStringReplaceMethod==='replaceAll'
            &&isRegExpLiteral
            &&!regexp?.flags.includes('g')){
            throw new Error('String.replaceAll regular expression must use the global flag')
        }
        if(!isRegExpLiteral&&!isString(search)){
            throw new Error('String.replace search value must be a string or regular expression literal')
        }
        const callback = replacement.value instanceof FuncElement
            ? replacement.value
            : null
        const isCallback = callback!==null
        if(!isString(replacement)&&!isCallback){
            throw new Error('String.replace replacement must be a string or callback function')
        }
        if(callback&&(
            callback.params.length!==1
            ||callback.params[0].type!=='string'
        )){
            throw new Error('String.replace callback must accept exactly one string argument')
        }
    }
    if(instance.builtinStringRange){
        if(instance.params.length<1||instance.params.length>2){
            throw new Error(`String.${instance.builtinStringRangeMethod} expects one or two integer arguments`)
        }
        for(const index of instance.params){
            const isNumericValue = Boolean(index.expression
                ||index.value instanceof DataElement&&index.value.type==='number')
            const numericKind = index.expression?.numericKind
                ??(index.value instanceof DataElement?index.value.numericKind:'integer')
            if(!isNumericValue||numericKind!=='integer'){
                throw new Error(`String.${instance.builtinStringRangeMethod} arguments must be integers`)
            }
        }
    }
    if(instance.builtinStringConcat){
        if(instance.params.length!==1){
            throw new Error('String.concat expects exactly one string argument')
        }
        const value = instance.params[0]
        const isString = typeof value.value==='string'
            &&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(value.value)
            ||value.value instanceof DataElement&&value.value.type==='string'&&!value.value.isArray
            ||value.classProperty?.type==='string'&&!value.classProperty.isArray
        if(!isString){
            throw new Error('String.concat argument must be a string')
        }
    }
    if(instance.builtinStringTransform){
        const method = instance.builtinStringTransformMethod
        if(method==='repeat'){
            if(instance.params.length!==1){
                throw new Error('String.repeat expects exactly one integer count')
            }
            const count = instance.params[0]
            const isNumericValue = Boolean(count.expression
                ||count.value instanceof DataElement&&count.value.type==='number')
            const numericKind = count.expression?.numericKind
                ??(count.value instanceof DataElement?count.value.numericKind:'integer')
            if(!isNumericValue||numericKind!=='integer'){
                throw new Error('String.repeat count must be an integer')
            }
        }else if(instance.params.length!==0){
            throw new Error(`String.${method} expects no arguments`)
        }
    }
    if(instance.builtinStringSearch){
        if(instance.params.length!==1){
            throw new Error(`String.${instance.builtinStringSearchMethod} expects exactly one string argument`)
        }
        const search = instance.params[0]
        const isString = typeof search.value==='string'
            &&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(search.value)
            ||search.value instanceof DataElement&&search.value.type==='string'&&!search.value.isArray
            ||search.classProperty?.type==='string'&&!search.classProperty.isArray
        if(!isString){
            throw new Error(`String.${instance.builtinStringSearchMethod} search value must be a string`)
        }
    }
    if(instance.noOp&&instance.params.length){
        throw new Error('Parent constructor does not accept arguments')
    }
    if(instance.prototypeReceiver&&prototype){
        instance.params.unshift(new FunctionArgument(instance,prototype.instance.name??''))
    }
    if(instance.builtinArrayToString&&instance.params.length!==0){
        throw new Error('Array.toString expects no arguments')
    }
    if(instance.builtinArrayBufferToString&&instance.params.length!==0){
        throw new Error('ArrayBuffer.toString expects no arguments')
    }
    if(instance.builtinArray){
        instance.builtinArray.dynamicArray = true
        instance.builtinArray.arrayHasMutation = true
        if(instance.params.length!==1){
            throw new Error('Array.push expects exactly one argument')
        }
        instance.validateArrayPush(instance.builtinArray,instance.params[0])
        const value = instance.params[0].value
        if(instance.builtinArray.classType
            &&value instanceof DataElement
            &&value.classType===instance.builtinArray.classType
            &&!value.isArray
            &&!value.isParameter){
            value.isHeapAllocated = true
        }
        instance.arrayPushId = ++arrayPushId
    }
    instance.prepareDynamicArrayArguments()
}
