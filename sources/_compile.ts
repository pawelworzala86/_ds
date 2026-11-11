import fs from 'fs'

export function Compile(source: string):string{

    function r(regex: RegExp, replacement: any): void {
        source = source.replace(regex, replacement)
    }

    function Blocks(source:string):string{
        let newSource = ''
        var tab = 1
        for(let index=0;index<source.length;index++){
            if(source[index]=='{'){
                newSource += ':'+tab
                tab++
            }
            if(source[index]=='}'){
                newSource += ':'+(tab-1)
                tab--
            }
            newSource += source[index]
        }
        return newSource
    }

    source = Blocks(source)

    const DATA:any = []
    const IMPORT:any = []
    const FUNCTION:any = []

    r(/declare\s+function\s+(\w+)\s*?\((.*)\).*\/\/(.*)/gm, (match:any, funcName:any, params:any, dll:any) => {
        if(IMPORT[dll]==undefined){
            IMPORT[dll] = []
        }
        IMPORT[dll].push(funcName)
        return ''
    })

    r(/(\w+)\s*\=\s*(\w+\(.*\))/gm, (match:any, targetName:any, callback:any) => {
        return `${callback}
        mov ${targetName}, rax`
    })

    r(/(const|let|var)\s+(\w+)\:(\w+)\s*=\s*(.*)/gm, (match:any, keyword:any, varName:any, varType:any, value:any) => {
        DATA.push({name:varName,value,type:varType})
        return ''
    })

    r(/(.*)\s*\=\s*(.*)/gm, `mov rax, $2\nmov $1, rax`)

    for(const data of DATA){
        if(data.type=='string'){
            r(new RegExp(`\\b(${data.name})\\b`,'gm'), `addr $1`)
        }else{
            r(new RegExp(`\\b(${data.name})\\b`,'gm'), `[$1]`)
        }
    }

    //[ptr][0]
    r(/\[([a-zA-Z0-9\_]+)\]\[([a-zA-Z0-9\_]+)\]/gm, (match:any, arrName:any, index:any) => {
        return `[${arrName}+${index*8}]`
    })

    //fs.writeFileSync('./cache/compiled.beforeFunc.asm', source);

    r(/function\s+(\w+)\s*\((.*)\)\s*(?<num>\:[0-9]+)\{([\s\S]+?)(\k<num>)\}/gm,(match:any, funcName:any, params:any, tabNum:any, body:any)=>{
        params = params.split(',').map((param:any)=>param.split(':')[0]).join(', ')
        FUNCTION.push(funcName)
        return `proc ${funcName} ${params}
        ${body}
        endp`
    })

    r(/(\w+)\((.*)\)/gm, (match:any, funcName:any, params:any) => {
        if(FUNCTION.includes(funcName)){
            return `rvcall ${funcName}, ${params}`
        }
        return `invoke ${funcName}, ${params}`
    })

    r(/\ \,\ /gm,', ')



    let importStr:any = ''
    for(let dll of Object.keys(IMPORT)){
        let functions:any = []
        IMPORT[dll].map((funcName:any)=>{
            functions.push(`${funcName},'${funcName}'`)
        })
        importStr += `import '${dll}.dll',${functions.join(',')}\n`
    }

    let dataStr:any = ''
    for(let data of DATA){
        let type = 'dq'
        if(data.type=='string'){
            dataStr += `${data.name} db ${data.value},0\n`
            type = 'db'
        }else{
            dataStr += `${data.name} ${type} ${data.value}\n`
        }
    }

    return `.code
    ${source}

.data
    ${dataStr}

.import
    ${importStr}`
}

export default Compile