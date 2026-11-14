export class Asm{
    data:any = []
    code:any = []
    proc:any = []
    imp:any = {}
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
    getASMCode(){
        let codeTxt = this.code.join('')
        let procTxt = this.proc.join('')
        let dataTxt = this.data.join('')
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