export function Compile(source: string):string{

    function r(regex: RegExp, replacement: any): void {
        source = source.replace(regex, replacement)
    }

    const DATA:any = []
    const IMPORT:any = []

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

    IMPORT.push(`
    import 'kernel32.dll',\
        ExitProcess,'ExitProcess'
    import 'msvcrt.dll',\
        printf,'printf',\
        malloc,'malloc'`)

    return `.code
    ${source}

.data
    ${DATA.join('\n')}

.import
    ${IMPORT.join('\n')}`
}

export default Compile