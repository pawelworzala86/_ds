export function getStringLiteralContents(literal:string):string{
    const quote = literal[0]
    if((quote!=="'"&&quote!=='"')||literal[literal.length-1]!==quote){
        throw new Error('Invalid string literal')
    }
    let escaped = false
    for(let index=1;index<literal.length-1;index++){
        const char = literal[index]
        if(escaped){
            escaped = false
        }else if(char==='\\'){
            escaped = true
        }else if(char===quote){
            throw new Error('Invalid string literal')
        }
    }
    if(escaped){
        throw new Error('Invalid string literal')
    }
    return literal.slice(1,-1)
}

export function decodeStringEscapes(value:string):string{
    let result = ''
    for(let index=0;index<value.length;index++){
        const char = value[index]
        if(char!=='\\'){
            result += char
            continue
        }
        const escaped = value[++index]
        if(escaped===undefined){
            throw new Error('Unterminated escape sequence in string literal')
        }
        switch(escaped){
            case 'n': result += '\n'; break
            case 'r': result += '\r'; break
            case 't': result += '\t'; break
            case 'b': result += '\b'; break
            case 'f': result += '\f'; break
            case 'v': result += '\v'; break
            case '0':
                if(/[0-9]/.test(value[index+1]??'')){
                    throw new Error('Octal escape sequences are not supported')
                }
                result += '\0'
                break
            case '\\': result += '\\'; break
            case "'": result += "'"; break
            case '"': result += '"'; break
            case '/': result += '/'; break
            case '\n': break
            case '\r':
                if(value[index+1]==='\n'){
                    index++
                }
                break
            case 'x': {
                const hex = value.slice(index+1,index+3)
                if(!/^[\da-f]{2}$/i.test(hex)){
                    throw new Error('Invalid hexadecimal escape in string literal')
                }
                result += String.fromCharCode(parseInt(hex,16))
                index += 2
                break
            }
            case 'u': {
                if(value[index+1]==='{'){
                    const close = value.indexOf('}',index+2)
                    const hex = close===-1?'':value.slice(index+2,close)
                    const codePoint = /^[\da-f]{1,6}$/i.test(hex)?parseInt(hex,16):-1
                    if(codePoint<0||codePoint>0x10ffff){
                        throw new Error('Invalid Unicode escape in string literal')
                    }
                    result += String.fromCodePoint(codePoint)
                    index = close
                }else{
                    const hex = value.slice(index+1,index+5)
                    if(!/^[\da-f]{4}$/i.test(hex)){
                        throw new Error('Invalid Unicode escape in string literal')
                    }
                    result += String.fromCharCode(parseInt(hex,16))
                    index += 4
                }
                break
            }
            default:
                throw new Error(`Unsupported escape sequence "\\${escaped}" in string literal`)
        }
    }
    return result
}

export function stringData(contents:string):string{
    const bytes = Array.from(new TextEncoder().encode(decodeStringEscapes(contents)))
    bytes.push(0)
    return `db ${bytes.join(',')}`
}

export function stringLiteralData(literal:string):string{
    return stringData(getStringLiteralContents(literal))
}
