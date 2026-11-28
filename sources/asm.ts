let programEndId = 0

export class Asm{
    runtimeOwner:Asm|null = null
    data:any = []
    code:any = []
    proc:any = []
    imp:any = {}
    hasBackgroundThreads = false
    addData(_data:string){
        this.data.push(_data+'\n')
    }
    addCode(_code:string){
        this.code.push(_code+'\n')
    }
    addCodeNLN(_code:string){
        this.code.push(_code)
    }
    addProc(_proc:string){
        this.proc.push(_proc+'\n')
    }
    getCode(){
        return this.code
    }
    getData(){
        return this.data
    }
    addImport(dll:string,func:string){
        if(!this.imp[dll]){
            this.imp[dll] = []
        }
        if(!this.imp[dll].includes(func)){
            this.imp[dll].push(func)
        }
    }
    markBackgroundThreads(){
        this.hasBackgroundThreads = true
    }
    getASMCode(){
        let codeTxt = this.code.join('')
        let procTxt = this.proc.join('')
        let dataTxt = this.data.join('')
        let impTxt = ''
        const programEnd = `__ds_program_end_${++programEndId}`
        const waitForBackgroundThreads = this.hasBackgroundThreads
            ? [
                '__ds_wait_for_background_threads:',
                'cmp qword [__ds_active_threads], 0',
                `je ${programEnd}`,
                'mov ecx, 10',
                'sub rsp, 32',
                'call [Sleep]',
                'add rsp, 32',
                'jmp __ds_wait_for_background_threads'
            ].join('\n')
            : ''
        if(this.hasBackgroundThreads){
            this.addImport('kernel32','Sleep')
            dataTxt += '__ds_active_threads dq 0\n'
        }
        for(let dll of Object.keys(this.imp)){
            let functions:any = []
            this.imp[dll].map((funcName:any)=>{
                functions.push(`${funcName},'${funcName}'`)
            })
            impTxt += `import '${dll}.dll',${functions.join(',')}\n`
        }
        return `.code
        ${codeTxt}
        ${waitForBackgroundThreads}
        jmp ${programEnd}
        ${procTxt}
    ${programEnd}:
        ret
    .data
        ${dataTxt}
    .import
        ${impTxt}
    `
    }
}

export default Asm