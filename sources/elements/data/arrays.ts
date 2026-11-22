export function splitTopLevelArrayValues(value:string):string[]{
    const items:string[] = []
    let current = ''
    let quote:string|null = null
    let depth = 0
    let escaped = false
    for(let index=0;index<value.length;index++){
        const char = value[index]
        if(quote){
            current += char
            if(escaped){
                escaped = false
            }else if(char==='\\'){
                escaped = true
            }else if(char===quote){
                quote = null
            }
            continue
        }
        if(char==="'"||char==='"'){
            quote = char
            escaped = false
            current += char
            continue
        }
        if(char==='('||char==='['||char==='{'){
            depth++
        }else if(char===')'||char===']'||char==='}'){
            depth--
        }
        if(char===','&&depth===0){
            const trimmed = current.trim()
            if(trimmed){
                items.push(trimmed)
            }
            current = ''
            continue
        }
        current += char
    }
    const trimmed = current.trim()
    if(trimmed){
        const item = trimmed.startsWith("'")&&trimmed.endsWith("'")
            ? `'${trimmed.slice(1,-1).trim()}'`
            : trimmed.startsWith('"')&&trimmed.endsWith('"')
                ? `"${trimmed.slice(1,-1).trim()}"`
                : trimmed
        items.push(item)
    }
    return items
}

export function splitTokenArrayValues(tokens:string[]):string[][]{
    if(tokens[0]!=='['||tokens[tokens.length-1]!==']'){
        throw new Error('Invalid array literal')
    }
    const items:string[][] = []
    let current:string[] = []
    let depth = 0
    let quote:string|null = null
    for(const token of tokens.slice(1,-1)){
        if(quote){
            current.push(token)
            if(token===quote){
                quote = null
            }
        }else if(token==="'"||token==='"'){
            quote = token
            current.push(token)
        }else if(['{','(','['].includes(token)){
            depth++
            current.push(token)
        }else if(['}',')',']'].includes(token)){
            depth--
            current.push(token)
        }else if(token===','&&depth===0){
            if(current.length){
                items.push(current)
            }
            current = []
        }else{
            current.push(token)
        }
    }
    if(current.length){
        items.push(current)
    }
    return items
}

