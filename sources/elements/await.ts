import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from '../asm.ts'
import DataElement from './dataElement.ts'

let awaitId = 0

export class Await extends Base{
    task:DataElement|null = null

    constructor(parent:Base){
        super(parent)
    }

    set(tokenizer:Tokenizer){
        tokenizer.get()
        const name = tokenizer.get()
        const task = this.getData(name)
        if(!task||task.type!=='Task'){
            throw new Error(`Await expects a Task variable, received "${name}"`)
        }
        this.task = task
    }

    asm(ASM:Asm){
        if(!this.task?.name){
            throw new Error('Await is not initialized')
        }
        const id = ++awaitId
        const failure = `__ds_await_failure_${id}`
        const done = `__ds_await_done_${id}`
        ASM.addImport('kernel32','WaitForSingleObject')
        ASM.addImport('kernel32','CloseHandle')
        ASM.addImport('kernel32','ExitProcess')
        ASM.addCode('push rbx')
        ASM.addCode(`mov rbx, [${this.task.name}]`)
        ASM.addCode('test rbx, rbx')
        ASM.addCode(`jz ${failure}`)
        ASM.addCode('mov rcx, rbx')
        ASM.addCode('mov edx, 0xffffffff')
        ASM.addCode('sub rsp, 32')
        ASM.addCode('call [WaitForSingleObject]')
        ASM.addCode('add rsp, 32')
        ASM.addCode('test eax, eax')
        ASM.addCode(`jnz ${failure}`)
        ASM.addCode('mov rcx, rbx')
        ASM.addCode('sub rsp, 32')
        ASM.addCode('call [CloseHandle]')
        ASM.addCode('add rsp, 32')
        ASM.addCode(`mov qword [${this.task.name}], 0`)
        ASM.addCode('pop rbx')
        ASM.addCode(`jmp ${done}`)
        ASM.addCode(`${failure}:`)
        ASM.addCode('mov ecx, 1')
        ASM.addCode('sub rsp, 32')
        ASM.addCode('call [ExitProcess]')
        ASM.addCode('add rsp, 32')
        ASM.addCode(`${done}:`)
    }

    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(token==='await'){
            tokenizer.move(-1)
            const statement = new Await(active)
            statement.set(tokenizer)
            active.children.push(statement)
            return statement
        }
        tokenizer.move(-1)
        return null
    }
}

export default Await
