import type {RegExpLiteral} from './types.ts'

export function readRegExpLiteralAt(text:string,start:number):{literal:string,end:number}|null{
    if(text[start]!=='/'){
        return null
    }
    let inCharacterClass = false
    let escaped = false
    for(let index=start+1;index<text.length;index++){
        const char = text[index]
        if(char==='\n'||char==='\r'){
            return null
        }
        if(escaped){
            escaped = false
        }else if(char==='\\'){
            escaped = true
        }else if(char==='['){
            inCharacterClass = true
        }else if(char===']'&&inCharacterClass){
            inCharacterClass = false
        }else if(char==='/'&&!inCharacterClass){
            let end = index+1
            while(/[a-z]/i.test(text[end]??'')){
                end++
            }
            return {literal:text.slice(start,end),end}
        }
    }
    return null
}

export function parseRegExpLiteral(literal:string):RegExpLiteral|null{
    const match = literal.match(/^\/([\s\S]*)\/([a-z]*)$/i)
    if(!match){
        return null
    }
    const flags = match[2]
    if(!/^[dgimsuvy]*$/.test(flags)||new Set(flags).size!==flags.length||flags.includes('u')&&flags.includes('v')){
        throw new Error(`Invalid regular expression flags "${flags}"`)
    }
    return {pattern:match[1],flags}
}
