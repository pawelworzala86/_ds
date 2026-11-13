export class Asm{
    data:any = []
    code:any = []
    proc:any = []
    imp:any = {}
    addData(_data:string){
        this.data.push(_data)
    }
    addCode(_code:string){
        this.code.push(_code)
    }
    addProc(_proc:string){
        this.proc.push(_proc)
    }
    getCode(){
        return this.code
    }
    addImport(dll:string,func:string){
        if(!this.imp[dll]){
            this.imp[dll] = []
        }
        this.imp[dll].push(func)
    }
    getASMCode(){
        let codeTxt = this.code.join('\n')
        let procTxt = this.proc.join('\n')
        let dataTxt = this.data.join('\n')
        let impTxt = ''
        for(let dll of Object.keys(this.imp)){
            let functions:any = []
            this.imp[dll].map((funcName:any)=>{
                functions.push(`${funcName},'${funcName}'`)
            })
            impTxt += `import '${dll}.dll',${functions.join(',')}\n`
        }
        return `.code
        ${codeTxt}
        ${procTxt}
    .data
        ${dataTxt}
    .import
        ${impTxt}
    `
    }
}

export default Asm