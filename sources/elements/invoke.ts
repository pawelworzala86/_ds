import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import FunctionArgument from './functionArgument.ts'
import Call from './call.ts'
import DataElement from './dataElement.ts'
import {stringLiteralData} from '../stringLiteral.ts'

let stringCharCodeAtId = 0
let invokeStringId = 0

const Invokers:any = []

function isMethodDeclaration(tokens:string[],index:number){
    if(tokens[index+1]!=='('){
        return false
    }
    let depth = 0
    for(let cursor=index+1;cursor<tokens.length;cursor++){
        if(tokens[cursor]==='('){
            depth++
        }else if(tokens[cursor]===')'&&--depth===0){
            cursor++
            while(tokens[cursor]==='\n'){
                cursor++
            }
            return tokens[cursor]==='{'
        }
    }
    return false
}

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
        const float32Params = this.params.map(param=>
            param.value instanceof DataElement
                &&param.value.declaredType?.toLowerCase()==='float32'
        )
        if(float32Params.some(Boolean)){
            const registers = ['rcx','rdx','r8','r9']
            const stackBytes = 32+Math.max(0,this.params.length-registers.length)*8
            const stackSize = stackBytes+(stackBytes%16===0?8:0)
            ASM.addCode(`sub rsp, ${stackSize}`)
            this.params.forEach((param,index)=>{
                const value = param.getCode(true)
                if(value===null){
                    throw new Error('Unable to resolve float32 native argument')
                }
                if(index<registers.length){
                    if(float32Params[index]){
                        ASM.addCode(`cvtsd2ss xmm${index}, qword ${value}`)
                    }else{
                        const address = value.match(/^addr\s+(.+)$/i)
                        if(address){
                            const target = address[1].trim()
                            const operand = target.startsWith('[')&&target.endsWith(']')
                                ? target
                                : `[${target}]`
                            ASM.addCode(`lea ${registers[index]}, ${operand}`)
                        }else{
                            ASM.addCode(`mov ${registers[index]}, ${value}`)
                        }
                    }
                }else{
                    const offset = 32+(index-registers.length)*8
                    if(float32Params[index]){
                        ASM.addCode(`cvtsd2ss xmm0, qword ${value}`)
                        ASM.addCode('movd eax, xmm0')
                        ASM.addCode(`mov qword [rsp+${offset}], rax`)
                    }else{
                        const address = value.match(/^addr\s+(.+)$/i)
                        if(address){
                            const target = address[1].trim()
                            const operand = target.startsWith('[')&&target.endsWith(']')
                                ? target
                                : `[${target}]`
                            ASM.addCode(`lea rax, ${operand}`)
                        }else{
                            ASM.addCode(`mov rax, ${value}`)
                        }
                        ASM.addCode(`mov qword [rsp+${offset}], rax`)
                    }
                }
            })
            ASM.addCode(`call [${this.name}]`)
            ASM.addCode(`add rsp, ${stackSize}`)
            return
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
        if(Invokers.includes(token)&&tokenizer.tokens[tokenizer.index]==='('&&!lineComment
            &&!isMethodDeclaration(tokenizer.tokens,tokenizer.index-1)){
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