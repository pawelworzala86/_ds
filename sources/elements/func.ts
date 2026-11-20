import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Make from './../make.ts'
import Asm from "./../asm.ts"
import FuncElement from './funcElement.ts'
import DataElement from './dataElement.ts'

let returnId = 0
let asyncWorkerId = 0

export class Func extends Base{
    static predeclared = new WeakSet<FuncElement>()
    element:FuncElement|null = null
    constructor(parent:Base){
        super(parent)
        this.isFunctionScope = true
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
            const element = new FuncElement(name,Tokenizer.getFunctionParams(tokens.slice(index+1,end+1)),isAsync,workerName)
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

        const params = Tokenizer.getFunctionParams(tokens)

        const bodyStart = tokens.indexOf('{')
        const bodyEnd = tokens.lastIndexOf('}')
        tokens = tokens.slice(bodyStart + 1, bodyEnd)

        for(const param of params){
            const arrayType = param.type.match(/^([a-z_$][\w$]*)\[\]$/i)
            const type = arrayType?arrayType[1]:param.type
            const element = new DataElement('let',param.name,type,'0')
            element.classType = this.parent?.getClass(type)?.name??null
            element.isArray = Boolean(arrayType)
            element.isParameter = true
            this.addData(element)
        }
        const tokenizer2 = new Tokenizer('')
        tokenizer2.tokens = tokens
        Make.compile(ASM,this,tokenizer2,null)
        for(const data of this.DATA){
            if(!data.isParameter&&!data.isReturnedArray&&(
                data.type==='number'&&!data.isArray
                ||data.type==='number'&&data.isArray&&!data.dynamicArray
                ||data.type==='Task'
                ||Boolean(data.classType)&&!data.isArray
            )){
                data.isProcedureLocal = true
            }
        }

        const predeclared = this.parent!.FUNCTIONS.find(func=>func.name===name&&Func.predeclared.has(func))
        const workerName = predeclared?.asyncWorkerName??(isAsync?`__ds_async_worker_${++asyncWorkerId}`:null)
        const element:FuncElement = new FuncElement(name,params.map(param=>({
            ...param,
            dynamicArray:Boolean(this.getData(param.name)?.dynamicArray)
        })),isAsync,workerName)
        element.returnArrayType = this.returnArrayType
        element.returnArrayNumericKind = this.returnArrayNumericKind
        if(predeclared){
            predeclared.params = element.params
            predeclared.isAsync = element.isAsync
            predeclared.asyncWorkerName = element.asyncWorkerName
            predeclared.returnArrayType = element.returnArrayType
            predeclared.returnArrayNumericKind = element.returnArrayNumericKind
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