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

    r(/(const|let|var)\s+(\w+)\:(\w+)\s*=\s*(.*)/gm, (match:any, keyword:any, varName:any, varType:any, value:any) => {
        console.log(`Compiling variable: ${varName} of type ${varType} with value ${value}`)
        if(varType=='string'){
            //value = value.trim().slice(1, -1)
            DATA.push(`${varName} db ${value},0`)
        }else{
            DATA.push(`${varName} dq ${value}`)
        }
        return ''
    })

    fs.writeFileSync('./cache/compiled.beforeFunc.asm', source);

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




    let importStr:any = ''
    for(let dll of Object.keys(IMPORT)){
        let functions:any = []
        IMPORT[dll].map((funcName:any)=>{
            functions.push(`${funcName},'${funcName}'`)
        })
        importStr += `import '${dll}.dll',${functions.join(',')}\n`
    }

    return `.code
    ${source}

.data
    ${DATA.join('\n')}

.import
    ${importStr}`
}

export default Compile