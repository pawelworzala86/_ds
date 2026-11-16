import Tokenizer from '../tokenizer.ts'
import Asm from '../asm.ts'
import Base from './base.ts'
import Make from '../make.ts'
import {emitExpression,parseExpression,type Expression} from '../maths.ts'

let timeoutId = 0

export class Timeout extends Base{
    id = ++timeoutId
    workerName = `__ds_timeout_worker_${this.id}`
    delay:Expression|null = null

    constructor(parent:Base){
        super(parent)
    }

    set(tokenizer:Tokenizer){
        if(tokenizer.get()!=='setTimeout'||tokenizer.get()!=='('){
            throw new Error('Invalid setTimeout call')
        }
        const args = tokenizer.getCallArguments()
        if(args.length!==2){
            throw new Error('setTimeout expects a callback and a delay')
        }
        const callback = args[0].match(/^\(\s*\)\s*=>\s*\{([\s\S]*)\}$/)
        if(!callback){
            throw new Error('setTimeout only supports zero-argument arrow callbacks with a block body')
        }
        this.delay = parseExpression(args[1].trim(),this)
        if(this.delay.numericKind!=='integer'){
            throw new Error('setTimeout delay must be an integer number of milliseconds')
        }
        this.validateCapturedLocals(callback[1])
        const callbackTokenizer = new Tokenizer(callback[1]+'\n')
        Make.compile(new Asm(),this,callbackTokenizer,null)
        for(const data of this.DATA){
            if(!data.isParameter&&(
                data.type==='number'&&!data.isArray
                ||data.type==='number'&&data.isArray&&!data.dynamicArray
                ||data.type==='Task'
                ||Boolean(data.classType)&&!data.isArray
            )){
                data.isProcedureLocal = true
            }
        }
    }

    validateCapturedLocals(callback:string){
        const tokens = new Tokenizer(callback).tokens
        const identifiers = new Set<string>()
        let quote:string|null = null
        for(const token of tokens){
            if(quote){
                if(token===quote){
                    quote = null
                }
                continue
            }
            if(token==="'"||token==='"'||token==='`'){
                quote = token
            }else if(/^[a-z_$][\w$]*$/i.test(token)){
                identifiers.add(token)
            }
        }
        for(let scope=this.parent;scope?.parent;scope=scope.parent){
            for(const data of scope.DATA){
                if(data.name&&identifiers.has(data.name)){
                    throw new Error(`setTimeout callback cannot capture local variable "${data.name}"`)
                }
            }
        }
    }

    asm(ASM:Asm,mode:'detached'|'handle'='detached'){
        if(!this.delay){
            throw new Error('setTimeout is not initialized')
        }
        const failure = `__ds_timeout_failure_${this.id}`
        const done = `__ds_timeout_done_${this.id}`
        const returnLabel = `__ds_timeout_return_${this.id}`
        this.returnLabel = returnLabel
        ASM.addImport('kernel32','CreateThread')
        ASM.addImport('kernel32','CloseHandle')
        ASM.addImport('kernel32','Sleep')
        ASM.addImport('kernel32','ExitProcess')

        emitExpression(this.delay,ASM)
        ASM.addCode('mov r9, rax')
        ASM.addCode('push rbx')
        ASM.addCode('xor ecx, ecx')
        ASM.addCode('xor edx, edx')
        ASM.addCode(`lea r8, [${this.workerName}]`)
        ASM.addCode('sub rsp, 48')
        ASM.addCode('mov qword [rsp+32], 0')
        ASM.addCode('mov qword [rsp+40], 0')
        ASM.addCode('call [CreateThread]')
        ASM.addCode('add rsp, 48')
        ASM.addCode('test rax, rax')
        ASM.addCode(`jz ${failure}`)
        if(mode==='handle'){
            ASM.addCode('pop rbx')
            ASM.addCode(`jmp ${done}`)
        }else{
            ASM.addCode('mov rcx, rax')
            ASM.addCode('sub rsp, 32')
            ASM.addCode('call [CloseHandle]')
            ASM.addCode('add rsp, 32')
            ASM.addCode('pop rbx')
            ASM.addCode(`jmp ${done}`)
        }
        ASM.addCode(`${failure}:`)
        ASM.addCode('mov ecx, 1')
        ASM.addCode('sub rsp, 32')
        ASM.addCode('call [ExitProcess]')
        ASM.addCode('add rsp, 32')
        ASM.addCode(`jmp ${done}`)
        ASM.addCode(`${done}:`)

        const callbackASM = new Asm()
        for(const child of this.children){
            child.asm(callbackASM)
        }
        for(const data of callbackASM.getData()){
            ASM.addData(data.trimEnd())
        }
        for(const proc of callbackASM.proc){
            ASM.addProc(proc.trimEnd())
        }
        for(const dll of Object.keys(callbackASM.imp)){
            for(const func of callbackASM.imp[dll]){
                ASM.addImport(dll,func)
            }
        }
        const worker = [
            `proc ${this.workerName}`,
            'mov ecx, ecx',
            'sub rsp, 40',
            'call [Sleep]',
            'add rsp, 40',
            ...callbackASM.getCode(),
            `${returnLabel}:`,
            'xor eax, eax',
            'ret',
            'endp'
        ].join('\n')
        ASM.addProc(worker)
    }

    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(token==='setTimeout'&&tokenizer.tokens[tokenizer.index]==='('){
            tokenizer.move(-1)
            const timeout = new Timeout(active)
            timeout.set(tokenizer)
            active.children.push(timeout)
            return timeout
        }
        tokenizer.move(-1)
        return null
    }
}

export default Timeout
