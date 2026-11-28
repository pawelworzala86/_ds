import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Make from './../make.ts'
import Asm from "./../asm.ts"
import FuncElement from './funcElement.ts'
import DataElement from './dataElement.ts'
import ClassElement from './clasElement.ts'
import {isPromiseType} from './promise.ts'
import TypePrototypeRegistry from './typePrototype.ts'

let returnId = 0
let structCodeEmissionId = 0
let asyncWorkerId = 0
let inferredStructId = 0
let inlineCallbackId = 0

export function createInlineCallback(active:Base,source:string,type:string|string[],arrayLength:number|null=null){
    const callback = source.match(/^\s*(?:\(\s*([^()]*)\s*\)|([a-z_$][\w$]*))\s*=>\s*\{([\s\S]*)\}\s*$/i)
    if(!callback){
        return null
    }
    const parameters = callback[1]!==undefined
        ? callback[1].trim()?callback[1].split(',').map(parameter=>parameter.trim()):[]
        : [callback[2]]
    if(parameters.some(parameter=>!parameter||!/^[a-z_$][\w$]*$/i.test(parameter))){
        return null
    }
    const types = Array.isArray(type)?type:parameters.map(()=>type)
    if(types.length!==parameters.length){
        throw new Error('Inline callback parameter count does not match its type')
    }
    const name = `__ds_inline_callback_${++inlineCallbackId}`
    const func = new Func(active)
    const signature = parameters.map((parameter,index)=>`${parameter}:${types[index]}`).join(',')
    const tokenizer = new Tokenizer(`function ${name}(${signature}){${callback[3]}}`)
    func.set(tokenizer,new Asm())
    if(tokenizer.has()||!func.element){
        throw new Error('Unable to compile inline callback')
    }
    const parameter = parameters.length?func.getData(parameters[0]):null
    if(parameter&&arrayLength!==null){
        parameter.arrayLength = arrayLength
    }
    active.children.push(func)
    return func.element
}

export class Func extends Base{
    static predeclared = new WeakSet<FuncElement>()
    element:FuncElement|null = null
    constructor(parent:Base){
        super(parent)
        this.isFunctionScope = true
    }
    static inferObjectArguments(active:Base,tokens:string[],functionName:string,params:{name:string,type:string}[]){
        const objectProperties = new Map<string,DataElement[]>()
        for(let index=0;index<tokens.length-4;index++){
            if(!['const','let','var'].includes(tokens[index])||tokens[index+2]!=='='||tokens[index+3]!=='{'){
                continue
            }
            const properties:DataElement[] = []
            let cursor = index+4
            while(cursor<tokens.length&&tokens[cursor]!=='}'){
                if(tokens[cursor]===','||tokens[cursor]==='\n'){
                    cursor++
                    continue
                }
                const name = tokens[cursor++]
                if(!/^[a-z_$][\w$]*$/i.test(name??'')||tokens[cursor++]!==':'){
                    break
                }
                let type:string
                let value:string
                if(tokens[cursor]==="'"||tokens[cursor]==='"'){
                    const quote = tokens[cursor++]
                    value = tokens[cursor++]??''
                    if(tokens[cursor++]!==quote){
                        break
                    }
                    type = 'string'
                }else if(tokens[cursor]==='true'||tokens[cursor]==='false'){
                    type = 'boolean'
                    value = tokens[cursor++]==='true'?'1':'0'
                }else{
                    value = tokens[cursor++]??''
                    if(!/^[+-]?(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(value)){
                        break
                    }
                    type = 'number'
                }
                properties.push(new DataElement('let',name,type,value))
                while(tokens[cursor]==='\n'){
                    cursor++
                }
                if(tokens[cursor]===','){
                    cursor++
                }else if(tokens[cursor]!=='}'){
                    break
                }
            }
            if(properties.length&&tokens[cursor]==='}'){
                objectProperties.set(tokens[index+1],properties)
            }
        }

        const argumentShapes:Array<DataElement[]|null> = Array(params.length).fill(null)
        for(let index=0;index<tokens.length-1;index++){
            if(tokens[index]!==functionName||tokens[index+1]!=='('||tokens[index-1]==='function'){
                continue
            }
            const argumentsList:string[][] = []
            let current:string[] = []
            let depth = 0
            for(let cursor=index+2;cursor<tokens.length;cursor++){
                const token = tokens[cursor]
                if(token==='('||token==='{'||token==='['){
                    depth++
                }else if(token===')'){
                    if(depth===0){
                        if(current.length){
                            argumentsList.push(current)
                        }
                        break
                    }
                    depth--
                }else if(token==='}'||token===']'){
                    depth--
                }
                if(token===','&&depth===0){
                    argumentsList.push(current)
                    current = []
                }else{
                    current.push(token)
                }
            }
            argumentsList.forEach((argument,index)=>{
                if(argument.length!==1){
                    return
                }
                const shape = objectProperties.get(argument[0])
                if(shape){
                    argumentShapes[index] = shape
                }
            })
        }

        return params.map((param,index)=>{
            if(param.type&&param.type!=='any'||!argumentShapes[index]){
                return param
            }
            const shape = argumentShapes[index]!
            const type = `__ds_inferred_${functionName}_${param.name}_${++inferredStructId}`
            active.addClass(new ClassElement(type,shape,[]))
            return {...param,type}
        })
    }
    static predeclare(active:Base,tokenizer:Tokenizer){
        let blockDepth = 0
        const tokens = tokenizer.tokens
        for(let index=0;index<tokens.length;index++){
            const token = tokens[index]
            if(token==='{'){
                blockDepth++
                continue
            }
            if(token==='}'){
                blockDepth--
                continue
            }
            if(blockDepth!==0||token!=='function'){
                continue
            }
            const name = tokens[index+1]
            if(!name||!/^[a-z_$][\w$]*$/i.test(name)||tokens[index+2]!=='('){
                continue
            }
            let depth = 0
            let end = index+2
            for(;end<tokens.length;end++){
                if(tokens[end]==='('){
                    depth++
                }else if(tokens[end]===')'&&--depth===0){
                    break
                }
            }
            if(end===tokens.length){
                continue
            }
            if(active.FUNCTIONS.some(func=>func.name===name)){
                continue
            }
            const isAsync = tokens[index-1]==='async'
            const workerName = isAsync?`__ds_async_worker_${++asyncWorkerId}`:null
            const params = Func.inferObjectArguments(active,tokens,name,Tokenizer.getFunctionParams(tokens.slice(index+1,end+1)))
            const element = new FuncElement(name,params,isAsync,workerName)
            active.addFunction(element)
            Func.predeclared.add(element)
        }
    }
    static predeclareClassMethods(active:Base,tokens:string[]){
        let blockDepth = 0
        for(let index=0;index<tokens.length;index++){
            const name = tokens[index]
            if(name==='{'){
                blockDepth++
                continue
            }
            if(name==='}'){
                blockDepth--
                continue
            }
            if(blockDepth!==0){
                continue
            }
            if(!name||['if','for','while','switch','catch'].includes(name)||!/^[a-z_$][\w$]*$/i.test(name)||tokens[index+1]!=='('
                ||tokens[index-1]==='.'||active.FUNCTIONS.some(func=>func.name===name)){
                continue
            }
            let depth = 0
            let signatureEnd = index+1
            for(;signatureEnd<tokens.length;signatureEnd++){
                if(tokens[signatureEnd]==='('){
                    depth++
                }else if(tokens[signatureEnd]===')'&&--depth===0){
                    break
                }
            }
            if(signatureEnd===tokens.length){
                continue
            }
            let bodyStart = signatureEnd+1
            while(tokens[bodyStart]==='\n'){
                bodyStart++
            }
            let returnType:string|null = null
            if(tokens[bodyStart]===':'){
                returnType = tokens[bodyStart+1]??null
                bodyStart += 2
                while(tokens[bodyStart]==='\n'){
                    bodyStart++
                }
            }
            if(tokens[bodyStart]!=='{'){
                continue
            }
            let bodyDepth = 0
            let bodyEnd = bodyStart
            for(;bodyEnd<tokens.length;bodyEnd++){
                if(tokens[bodyEnd]==='{'){
                    bodyDepth++
                }else if(tokens[bodyEnd]==='}'&&--bodyDepth===0){
                    break
                }
            }
            if(bodyEnd===tokens.length){
                continue
            }
            const params = Tokenizer.getFunctionParams(tokens.slice(index,signatureEnd+1)).map(param=>{
                const resolvedType = TypePrototypeRegistry.resolveType(param.type)
                return {
                    ...param,
                    type:resolvedType.isArray?`${resolvedType.type}[]`:resolvedType.type,
                    declaredType:resolvedType.declaredType??null,
                    numericKind:resolvedType.numericKind??undefined
                }
            })
            const element = new FuncElement(name,params)
            if(returnType){
                const resolvedReturnType = TypePrototypeRegistry.resolveType(returnType)
                element.returnType = resolvedReturnType.isArray
                    ? `${resolvedReturnType.type}[]`
                    : resolvedReturnType.type
                element.returnClassType = active.getClass(resolvedReturnType.type)?.name??null
            }
            active.addFunction(element)
            Func.predeclared.add(element)
            index = bodyEnd
        }
    }
    set(tokenizer:Tokenizer,ASM:Asm,classMethod=false,isAsync=false){
        let tokens:string[] = tokenizer.getBlock()
        const prefixLength = classMethod?1:isAsync?3:2
        const name = tokens[classMethod?0:isAsync?2:1]
        tokens.splice(0,prefixLength)
        //console.log('tokens',tokens)

        const predeclared = this.parent!.FUNCTIONS.find(func=>func.name===name&&Func.predeclared.has(func))
        const params = Tokenizer.getFunctionParams(tokens).map((param,index)=>{
            const rawType = param.type==='any'
                ? predeclared?.params[index]?.declaredType??predeclared?.params[index]?.type??param.type
                : param.type||predeclared?.params[index]?.declaredType||predeclared?.params[index]?.type||''
            const resolvedType = TypePrototypeRegistry.resolveType(rawType)
            return {
                ...param,
                type:resolvedType.isArray?`${resolvedType.type}[]`:resolvedType.type,
                declaredType:resolvedType.declaredType
                    ??predeclared?.params[index]?.declaredType
                    ??null,
                numericKind:resolvedType.numericKind??undefined
            }
        })

        const bodyStart = tokens.indexOf('{')
        const bodyEnd = tokens.lastIndexOf('}')
        const signatureEnd = tokens.indexOf(')')
        const declaredReturnType = tokens[signatureEnd+1]===':'?tokens[signatureEnd+2]??null:null
        const resolvedReturnType = declaredReturnType
            ? TypePrototypeRegistry.resolveType(declaredReturnType)
            : null
        const returnType = resolvedReturnType
            ? resolvedReturnType.isArray?`${resolvedReturnType.type}[]`:resolvedReturnType.type
            : null
        this.returnType = returnType
        tokens = tokens.slice(bodyStart + 1, bodyEnd)

        for(const param of params){
            const arrayType = param.type.match(/^([a-z_$][\w$]*)\[\]$/i)
            const type = arrayType?arrayType[1]:param.type
            const element = new DataElement('let',param.name,type==='float'?'number':type,'0')
            element.declaredType = param.declaredType??null
            if(type==='float'||param.numericKind==='float'){
                element.numericKind = 'float'
            }
            element.classType = this.parent?.getClass(type)?.name??null
            element.isArray = Boolean(arrayType)
            element.isParameter = true
            element.isDynamicJSON = type==='any'
                &&!element.isArray
                &&param.declaredType?.toLowerCase()!=='staticjson'
            this.addData(element)
        }
        const tokenizer2 = new Tokenizer('')
        tokenizer2.tokens = tokens
        Make.compile(ASM,this,tokenizer2,null)
        for(const data of this.DATA){
            if(!data.isParameter&&!data.isReturnedArray&&(
                data.type==='number'&&!data.isArray
                ||data.type==='number'&&data.isArray&&!data.dynamicArray
                ||data.type==='boolean'&&!data.isArray
                ||data.type==='boolean'&&data.isArray&&!data.dynamicArray
                ||data.type==='ArrayBuffer'&&!data.isArray
                ||data.type==='Task'
                ||data.type==='any'&&data.isDynamicJSON&&!data.isArray
                ||isPromiseType(data.type??undefined)&&data.type!=='Promise'
                ||Boolean(data.classType)&&!data.isArray
            )){
                data.isProcedureLocal = true
            }
        }

        const workerName = predeclared?.asyncWorkerName??(isAsync?`__ds_async_worker_${++asyncWorkerId}`:null)
        const element:FuncElement = new FuncElement(name,params.map(param=>({
            ...param,
            dynamicArray:Boolean(this.getData(param.name)?.dynamicArray)
        })),isAsync,workerName)
        element.returnArrayType = this.returnArrayType
        element.returnArrayNumericKind = this.returnArrayNumericKind
        element.returnClassType = this.returnClassType
        element.returnThis = this.returnThis??false
        element.returnType = this.returnType
        if(predeclared){
            predeclared.params = element.params
            predeclared.isAsync = element.isAsync
            predeclared.asyncWorkerName = element.asyncWorkerName
            predeclared.returnArrayType = element.returnArrayType
            predeclared.returnArrayNumericKind = element.returnArrayNumericKind
            predeclared.returnClassType = element.returnClassType
            predeclared.returnThis = element.returnThis
            predeclared.returnType = element.returnType
            this.element = predeclared
            Func.predeclared.delete(predeclared)
        }else{
            this.element = element
            this.parent!.addFunction(element)
        }
    }
    asm(ASM:Asm){
        const asm = new Asm()
        asm.runtimeOwner = ASM.runtimeOwner??ASM
        this.returnLabel = `__ds_return_${++returnId}`
        const params = this.element?.params.map((param:any)=>{
            return param.name
        }).join(',')
        asm.addCode(`proc ${this.element!.name} ${params}`)
        for(const node of this.children){
            node.asm(asm)
        }
        if(asm.hasBackgroundThreads){
            ASM.markBackgroundThreads()
        }
        asm.addCode(`${this.returnLabel}:`)
        asm.addCode('ret')
        asm.addCode(`endp`)
        const code = asm.getCode().join('\n')
        for(const data of asm.getData()){
            ASM.addData(data.trimEnd())
        }
        for(const dll of Object.keys(asm.imp)){
            for(const importedFunction of asm.imp[dll]){
                ASM.addImport(dll,importedFunction)
            }
        }
        for(const procedure of asm.proc){
            const isJSONRuntime = procedure.includes('proc __ds_json_alloc')
            const hasJSONRuntime = ASM.proc.some((existing:string)=>existing.includes('proc __ds_json_alloc'))
            if(isJSONRuntime&&hasJSONRuntime){
                continue
            }
            ASM.addProc(procedure.trimEnd())
        }
        ASM.addProc(code)
        if(this.element?.isAsync&&this.element.asyncWorkerName){
            const worker = new Asm()
            worker.addCode(`proc ${this.element.asyncWorkerName}`)
            worker.addCode('local __ds_async_args dq')
            worker.addCode('mov __ds_async_args, rcx')
            for(let index=0;index<this.element.params.length;index++){
                worker.addCode('mov rdx, __ds_async_args')
                worker.addCode(`mov rax, [rdx+${index*8}]`)
                worker.addCode('push rax')
            }
            const shadowSpace = 32+(this.element.params.length%2===0?8:0)
            worker.addCode(`sub rsp, ${shadowSpace}`)
            worker.addCode(`call ${this.element.name}`)
            worker.addCode(`add rsp, ${shadowSpace+this.element.params.length*8}`)
            if(this.element.params.length){
                ASM.addImport('msvcrt','free')
                worker.addCode('mov rcx, __ds_async_args')
                worker.addCode('sub rsp, 40')
                worker.addCode('call [free]')
                worker.addCode('add rsp, 40')
            }
            worker.addCode('lock')
            worker.addCode('dec qword [__ds_active_threads]')
            worker.addCode('xor eax, eax')
            worker.addCode('ret')
            worker.addCode('endp')
            ASM.addProc(worker.getCode().join(''))
        }
        if(this.element?.nativeCallbackName){
            const params = this.element.params
            if(params.length>4){
                throw new Error(`Function "${this.element.name}" has too many parameters for a native callback`)
            }
            const registers = ['rcx','rdx','r8','r9']
            const callbackArguments = params.map((_,index)=>`${this.element!.nativeCallbackName}_arg_${index+1}`)
            const shadowSpace = 32+(params.length%2===0?8:0)
            const callback = [
                `proc ${this.element.nativeCallbackName}`,
                ...callbackArguments.map(name=>`local ${name} dq 0`),
                ...callbackArguments.map((name,index)=>`mov [${name}], ${registers[index]}`),
                ...callbackArguments.map((name,index)=>`mov ${registers[index]}, [${name}]`),
                ...params.map((_,index)=>`push ${registers[index]}`),
                `sub rsp, ${shadowSpace}`,
                `call ${this.element.name}`,
                `add rsp, ${shadowSpace+params.length*8}`,
                'ret',
                'endp'
            ].join('\n')
            ASM.addProc(callback)
        }
    }
    getStructCode(ASM:Asm){
        const asm = new Asm()
        asm.runtimeOwner = ASM.runtimeOwner??ASM
        const emissionId = ++structCodeEmissionId
        this.returnLabel = `__ds_return_${++returnId}`
        for(const node of this.children){
            node.asm(asm)
        }
        asm.addCode(`${this.returnLabel}:`)
        asm.addCode('ret')
        const params = this.element?.params.map((param:any)=>param.name).join(', ')
        const symbols = new Set<string>()
        for(const line of asm.getData()){
            const label = line.match(/^\s*(__ds_[\w$]+)\s+(?:dq|db|dw|dd|dt)\b/i)?.[1]
            if(label){
                symbols.add(label)
            }
        }
        for(const line of asm.getCode()){
            const label = line.match(/^\s*(__ds_[\w$]+):\s*$/i)?.[1]
            if(label){
                symbols.add(label)
            }
        }
        const remapSymbols = (text:string)=>{
            let remapped = text
            for(const symbol of symbols){
                remapped = remapped.replace(
                    new RegExp(`\\b${symbol}\\b`,'g'),
                    `${symbol}_emit_${emissionId}`
                )
            }
            return remapped
        }
        const body = remapSymbols(asm.getCode().join('').trimEnd())
        const signature = `proc ${this.element!.name}${params?`, ${params}`:''}`
        for(const data of asm.getData()){
            ASM.addData(remapSymbols(data.trimEnd()))
        }
        for(const dll of Object.keys(asm.imp)){
            for(const importedFunction of asm.imp[dll]){
                ASM.addImport(dll,importedFunction)
            }
        }
        return `${signature}${body?`\n${body}`:''}\nret\nendp`
    }
    static test(active:Base,tokenizer:Tokenizer,ASM:Asm,classMethod=false){
        const token = tokenizer.get()
        if(token==='async'&&tokenizer.tokens[tokenizer.index]==='function'){
            tokenizer.move(-1)
            const data = new Func(active)
            data.set(tokenizer,ASM,false,true)
            active.children.push(data)
            return data
        }
        if(token==='function'){
            tokenizer.move(-1)
            const data = new Func(active)
            data.set(tokenizer,ASM)
            active.children.push(data)
            return data
        }
        if(classMethod){
            const next = tokenizer.get()
            tokenizer.move(-2)
            if(next==='('&&!['if','for','while','switch','catch'].includes(token)){
                const data = new Func(active)
                data.set(tokenizer,ASM,true)
                active.children.push(data)
                return data
            }
            return null
        }
        tokenizer.move(-1)
        return null
    }
}

export default Func