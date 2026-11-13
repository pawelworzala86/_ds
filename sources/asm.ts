const data:any = []
const code:any = []
const proc:any = []
const imp:any = {}

export function addData(_data:string){
    data.push(_data)
}
export function addCode(_code:string){
    code.push(_code)
}
export function addProc(_proc:string){
    proc.push(_proc)
}
export function addImport(dll:string,func:string){
    if(!imp[dll]){
        imp[dll] = []
    }
    imp[dll].push(func)
}
export function getCode(){
    let codeTxt = code.join('\n')
    let procTxt = proc.join('\n')
    let dataTxt = data.join('\n')
    let impTxt = ''
    for(let dll of Object.keys(imp)){
        let functions:any = []
        imp[dll].map((funcName:any)=>{
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

export default {
    addData,
    addCode,
    addImport,
    getCode,
    addProc,
}