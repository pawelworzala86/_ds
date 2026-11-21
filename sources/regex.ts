export interface RegExpLiteral{
    pattern:string
    flags:string
}

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

export function getLiteralRegExpSeparator(literal:string):string{
    const regexp = parseRegExpLiteral(literal)
    if(!regexp){
        throw new Error('Invalid regular expression literal')
    }
    if(regexp.flags.includes('i')){
        throw new Error('Case-insensitive regular expression separators are not supported')
    }
    if(regexp.flags.includes('s')||regexp.flags.includes('d')||regexp.flags.includes('u')||regexp.flags.includes('v')||regexp.flags.includes('y')){
        throw new Error(`Regular expression flags "${regexp.flags}" are not supported by String.split`)
    }
    let result = ''
    for(let index=0;index<regexp.pattern.length;index++){
        const char = regexp.pattern[index]
        if(char==='\\'){
            const escaped = regexp.pattern[++index]
            if(escaped===undefined){
                throw new Error('Unterminated escape sequence in regular expression')
            }
            switch(escaped){
                case 'n': result += '\n'; break
                case 'r': result += '\r'; break
                case 't': result += '\t'; break
                case 'v': result += '\v'; break
                case 'f': result += '\f'; break
                case '0': result += '\0'; break
                case 'x': {
                    const hex = regexp.pattern.slice(index+1,index+3)
                    if(!/^[\da-f]{2}$/i.test(hex)){
                        throw new Error('Invalid hexadecimal escape in regular expression')
                    }
                    result += String.fromCharCode(parseInt(hex,16))
                    index += 2
                    break
                }
                case 'u': {
                    const hex = regexp.pattern.slice(index+1,index+5)
                    if(!/^[\da-f]{4}$/i.test(hex)){
                        throw new Error('Invalid Unicode escape in regular expression')
                    }
                    result += String.fromCharCode(parseInt(hex,16))
                    index += 4
                    break
                }
                default:
                    if(/[a-z0-9]/i.test(escaped)){
                        throw new Error(`Regular expression escape "\\${escaped}" is not supported by String.split`)
                    }
                    result += escaped
            }
        }else if('.^$*+?{}[]()|'.includes(char)){
            throw new Error(`Regular expression operator "${char}" is not supported by String.split`)
        }else{
            result += char
        }
    }
    return result
}
