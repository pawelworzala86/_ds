import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import FunctionArgument from './functionArgument.ts'
import Call from './call.ts'
import {stringLiteralData} from '../stringLiteral.ts'

let stringCharCodeAtId = 0
let invokeStringId = 0

const Invokers:any = []

export function setInvoke(name:string){
    Invokers.push(name)
}

export function isInvoke(name:string){
    return Invokers.includes(name)
}

export class Invoke extends Base{
    name:string|null = null
    params:FunctionArgument[] = []
    nestedArgumentCalls = new Map<FunctionArgument,Call>()
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        this.name = tokenizer.get()
        if(tokenizer.get()!=='('){
            throw new Error(`Expected '(' after function "${this.name}"`)
        }
        const argumentTexts = tokenizer.getCallArguments()
        this.params = argumentTexts.map(token=>new FunctionArgument(this,token))
        this.params.forEach((param,index)=>{
            const argument = argumentTexts[index]
            if(!/^[a-z_$][\w$]*\.charCodeAt\([\s\S]*\)$/i.test(argument)){
                return
            }
            const nestedTokenizer = new Tokenizer(argument)
            const nestedCall = new Call(this)
            nestedCall.set(nestedTokenizer)
            if(nestedTokenizer.has()||!nestedCall.builtinStringCharCodeAt){
                throw new Error('charCodeAt is only supported for strings')
            }
            param.tempName = `__ds_invoke_string_char_code_at_${++stringCharCodeAtId}`
            this.nestedArgumentCalls.set(param,nestedCall)
        })
    }
    asm(ASM:Asm){
        for(const param of this.params){
            const nestedCall = this.nestedArgumentCalls.get(param)
            if(nestedCall){
                nestedCall.asm(ASM)
                ASM.addData(`${param.tempName} dq 0`)
                ASM.addCode(`mov [${param.tempName}], rax`)
            }else{
                param.asm(ASM)
            }
        }
        const params = this.params.map(param=>{
            const value = param.getCode(true)
            if(typeof value==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(value)){
                const label = `__ds_invoke_string_${++invokeStringId}`
                ASM.addData(`${label} ${stringLiteralData(value)}`)
                return `addr ${label}`
            }
            return value
        }).join(', ')
        const code = `invoke ${this.name} ${params}`
        ASM.addCode(code)
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        const lineStart = tokenizer.tokens.lastIndexOf('\n',tokenizer.index-2)+1
        const lineComment = tokenizer.tokens[lineStart]?.startsWith(';')??false
        if(Invokers.includes(token)&&tokenizer.tokens[tokenizer.index]==='('&&!lineComment){
            tokenizer.move(-1)
            const data = new Invoke(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Invoke