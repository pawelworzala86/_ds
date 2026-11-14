import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Make from './../make.ts'
import Asm from "./../asm.ts"
import FuncElement from './funcElement.ts'
import DataElement from './dataElement.ts'

export class Func extends Base{
    element:FuncElement|null = null
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer,ASM:Asm,classMethod=false){
        let tokens:string[] = tokenizer.getBlock()
        const name = classMethod?tokens[0]:tokens[1]
        tokens.splice(0,classMethod?1:2)
        //console.log('tokens',tokens)

        const params:any = Tokenizer.getFunctionParams(tokens)

        const bodyStart = tokens.indexOf('{')
        const bodyEnd = tokens.lastIndexOf('}')
        tokens = tokens.slice(bodyStart + 1, bodyEnd)

        for(const param of params){
            const arrayType = param.type.match(/^([a-z_$][\w$]*)\[\]$/i)
            const type = arrayType?`${arrayType[1]}[]`:param.type
            const element = new DataElement('let',param.name,type,'0')
            element.isArray = Boolean(arrayType)
            element.isParameter = true
            this.addData(element)
        }
        const tokenizer2 = new Tokenizer('')
        tokenizer2.tokens = tokens
        Make.compile(ASM,this,tokenizer2,null)

        const element:FuncElement = new FuncElement(name,params)
        this.element = element
        this.parent!.addFunction(element)
    }
    asm(ASM:Asm){
        const asm = new Asm()
        const params = this.element?.params.map((param:any)=>{
            return param.name
        }).join(',')
        asm.addCode(`proc ${this.element!.name} ${params}`)
        for(const node of this.children){
            node.asm(asm)
        }
        asm.addCode(`endp`)
        const code = asm.getCode().join('\n')
        for(const data of asm.getData()){
            ASM.addData(data.trimEnd())
        }
        ASM.addProc(code)
    }
    getStructCode(ASM:Asm){
        const asm = new Asm()
        for(const node of this.children){
            node.asm(asm)
        }
        const params = this.element?.params.map((param:any)=>param.name).join(', ')
        const body = asm.getCode().join('').trimEnd()
        const signature = `proc ${this.element!.name}${params?`, ${params}`:''}`
        for(const data of asm.getData()){
            ASM.addData(data.trimEnd())
        }
        return `${signature}${body?`\n${body}`:''}\nendp`
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