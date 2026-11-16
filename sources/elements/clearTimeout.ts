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
        const timerName = this.timer.getAccessName()
        ASM.addImport('kernel32','TerminateThread')
        ASM.addImport('kernel32','CloseHandle')
        ASM.addCode('push rbx')
        ASM.addCode(`cmp qword [${timerName}], 0`)
        ASM.addCode(`je ${done}`)
        ASM.addCode(`mov rcx, [${timerName}]`)
        ASM.addCode('xor edx, edx')
        ASM.addCode('sub rsp, 32')
        ASM.addCode('call [TerminateThread]')
        ASM.addCode('add rsp, 32')
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
