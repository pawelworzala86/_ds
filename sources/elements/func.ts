import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Make from './../make.ts'
import Asm from "./../asm.ts"
import FuncElement from './funcElement.ts'
import DataElement from './dataElement.ts'

let returnId = 0

export class Func extends Base{
    static predeclared = new WeakSet<FuncElement>()
    element:FuncElement|null = null
    constructor(parent:Base){
        super(parent)
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
            const element = new FuncElement(name,Tokenizer.getFunctionParams(tokens.slice(index+1,end+1)))
            active.addFunction(element)
            Func.predeclared.add(element)
        }
    }
    set(tokenizer:Tokenizer,ASM:Asm,classMethod=false){
        let tokens:string[] = tokenizer.getBlock()
        const name = classMethod?tokens[0]:tokens[1]
        tokens.splice(0,classMethod?1:2)
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
            if(!data.isParameter&&(
                data.type==='number'&&!data.isArray
                ||data.type==='number'&&data.isArray&&!data.dynamicArray
                ||Boolean(data.classType)&&!data.isArray
            )){
                data.isProcedureLocal = true
            }
        }

        const element:FuncElement = new FuncElement(name,params.map(param=>({
            ...param,
            dynamicArray:Boolean(this.getData(param.name)?.dynamicArray)
        })))
        const predeclared = this.parent!.FUNCTIONS.find(func=>func.name===name&&Func.predeclared.has(func))
        if(predeclared){
            predeclared.params = element.params
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
        ASM.addProc(code)
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