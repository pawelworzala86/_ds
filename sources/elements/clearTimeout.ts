import Asm from '../asm.ts'
import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import DataElement from './dataElement.ts'

let clearTimeoutId = 0

export class ClearTimeout extends Base{
    id = ++clearTimeoutId
    timer:DataElement|null = null

    constructor(parent:Base){
        super(parent)
    }

    set(tokenizer:Tokenizer){
        if(tokenizer.get()!=='clearTimeout'||tokenizer.get()!=='('){
            throw new Error('Invalid clearTimeout call')
        }
        const args = tokenizer.getCallArguments()
        if(args.length!==1){
            throw new Error('clearTimeout expects a Task id')
        }
        const name = args[0].trim()
        if(!/^[a-z_$][\w$]*$/i.test(name)){
            throw new Error('clearTimeout expects a Task variable')
        }
        const timer = this.getData(name)
        if(!timer||timer.type!=='Task'){
            throw new Error(`clearTimeout expects a Task variable, received "${name}"`)
        }
        this.timer = timer
    }

    asm(ASM:Asm){
        if(!this.timer?.name){
            throw new Error('clearTimeout is not initialized')
        }
        const done = `__ds_clear_timeout_done_${this.id}`
        const acquireLock = `__ds_clear_timeout_acquire_${this.id}`
        const skipTerminate = `__ds_clear_timeout_skip_terminate_${this.id}`
        const terminateFailed = `__ds_clear_timeout_terminate_failed_${this.id}`
        const releaseLock = `__ds_clear_timeout_release_${this.id}`
        const timerName = this.timer.getAccessName()
        if(!this.timer.timeoutLockName||!this.timer.timeoutCompletedName){
            throw new Error('clearTimeout expects a Task variable initialized with setTimeout')
        }
        ASM.addImport('kernel32','TerminateThread')
        ASM.addImport('kernel32','CloseHandle')
        ASM.addCode('push rbx')
        ASM.addCode(`cmp qword [${timerName}], 0`)
        ASM.addCode(`je ${done}`)
        ASM.addCode(`${acquireLock}:`)
        ASM.addCode('mov rax, 1')
        ASM.addCode(`xchg qword [${this.timer.timeoutLockName}], rax`)
        ASM.addCode('test rax, rax')
        ASM.addCode(`jnz ${acquireLock}`)
        ASM.addCode(`cmp qword [${this.timer.timeoutCompletedName}], 0`)
        ASM.addCode(`jne ${skipTerminate}`)
        ASM.addCode(`mov rcx, [${timerName}]`)
        ASM.addCode('xor edx, edx')
        ASM.addCode('sub rsp, 32')
        ASM.addCode('call [TerminateThread]')
        ASM.addCode('add rsp, 32')
        ASM.addCode('test eax, eax')
        ASM.addCode(`jz ${terminateFailed}`)
        ASM.addCode(`mov qword [${this.timer.timeoutCompletedName}], 1`)
        ASM.addCode('lock')
        ASM.addCode('dec qword [__ds_active_threads]')
        ASM.addCode(`jmp ${releaseLock}`)
        ASM.addCode(`${terminateFailed}:`)
        ASM.addCode(`${skipTerminate}:`)
        ASM.addCode(`${releaseLock}:`)
        ASM.addCode(`mov qword [${this.timer.timeoutLockName}], 0`)
        ASM.addCode(`mov rcx, [${timerName}]`)
        ASM.addCode('sub rsp, 32')
        ASM.addCode('call [CloseHandle]')
        ASM.addCode('add rsp, 32')
        ASM.addCode(`mov qword [${timerName}], 0`)
        ASM.addCode(`${done}:`)
        ASM.addCode('pop rbx')
    }

    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(token==='clearTimeout'&&tokenizer.tokens[tokenizer.index]==='('){
            tokenizer.move(-1)
            const clearTimeout = new ClearTimeout(active)
            clearTimeout.set(tokenizer)
            active.children.push(clearTimeout)
            return clearTimeout
        }
        tokenizer.move(-1)
        return null
    }
}

export default ClearTimeout
