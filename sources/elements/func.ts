import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Make from './../make.ts'
import Asm from "./../asm.ts"
import FuncElement from './funcElement.ts'
import DataElement from './dataElement.ts'
import ClassElement from './clasElement.ts'

let returnId = 0
let asyncWorkerId = 0
let inferredStructId = 0

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
    set(tokenizer:Tokenizer,ASM:Asm,classMethod=false,isAsync=false){
        let tokens:string[] = tokenizer.getBlock()
        const prefixLength = classMethod?1:isAsync?3:2
        const name = tokens[classMethod?0:isAsync?2:1]
        tokens.splice(0,prefixLength)
        //console.log('tokens',tokens)

        const predeclared = this.parent!.FUNCTIONS.find(func=>func.name===name&&Func.predeclared.has(func))
        const params = Tokenizer.getFunctionParams(tokens).map((param,index)=>({
            ...param,
            type:param.type==='any'
                ? predeclared?.params[index]?.type||param.type
                : param.type||predeclared?.params[index]?.type||''
        }))

        const bodyStart = tokens.indexOf('{')
        const bodyEnd = tokens.lastIndexOf('}')
        const signatureEnd = tokens.indexOf(')')
        const returnType = tokens[signatureEnd+1]===':'?tokens[signatureEnd+2]??null:null
        tokens = tokens.slice(bodyStart + 1, bodyEnd)

        for(const param of params){
            const arrayType = param.type.match(/^([a-z_$][\w$]*)\[\]$/i)
            const type = arrayType?arrayType[1]:param.type
            const element = new DataElement('let',param.name,type==='float'?'number':type,'0')
            if(type==='float'){
                element.numericKind = 'float'
            }
            element.classType = this.parent?.getClass(type)?.name??null
            element.isArray = Boolean(arrayType)
            element.isParameter = true
            this.addData(element)
        }
        const tokenizer2 = new Tokenizer('')
        tokenizer2.tokens = tokens
        Make.compile(ASM,this,tokenizer2,null)
        for(const data of this.DATA){
            if(!data.isParameter&&(
                data.isArray&&data.dynamicArray&&data.isReturnedArray
                ||!data.isReturnedArray&&(
                    data.type==='number'&&!data.isArray
                    ||data.type==='number'&&data.isArray&&!data.dynamicArray
                    ||data.type==='boolean'&&!data.isArray
                    ||data.type==='boolean'&&data.isArray&&!data.dynamicArray
                    ||data.type==='ArrayBuffer'&&!data.isArray
                    ||data.type==='Task'
                    ||Boolean(data.classType)&&!data.isArray
                )
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
        element.returnType = returnType
        if(predeclared){
            predeclared.params = element.params
            predeclared.isAsync = element.isAsync
            predeclared.asyncWorkerName = element.asyncWorkerName
            predeclared.returnArrayType = element.returnArrayType
            predeclared.returnArrayNumericKind = element.returnArrayNumericKind
            predeclared.returnClassType = element.returnClassType
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
            const shadowSpace = 32+(params.length%2===0?8:0)
            const callback = [
                `proc ${this.element.nativeCallbackName}`,
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
        this.returnLabel = `__ds_return_${++returnId}`
        for(const node of this.children){
            node.asm(asm)
        }
        asm.addCode(`${this.returnLabel}:`)
        asm.addCode('ret')
        const params = this.element?.params.map((param:any)=>param.name).join(', ')
        const body = asm.getCode().join('').trimEnd()
        const signature = `proc ${this.element!.name}${params?`, ${params}`:''}`
        for(const data of asm.getData()){
            ASM.addData(data.trimEnd())
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
            if(next==='('){
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