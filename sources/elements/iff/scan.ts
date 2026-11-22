export function isWrapped(text:string){
    if(text[0]!=='('||text[text.length-1]!==')'){
        return false
    }
    let depth = 0
    let quote:string|null = null
    for(let index=0;index<text.length;index++){
        const char = text[index]
        if(quote){
            if(char==='\\'){
                index++
            }else if(char===quote){
                quote = null
            }
            continue
        }
        if(char==="'"||char==='"'){
            quote = char
        }else if(char==='('){
            depth++
        }else if(char===')'){
            depth--
            if(depth===0&&index!==text.length-1){
                return false
            }
        }
    }
    return depth===0
}

export function findTopLevel(text:string,operator:string,fromRight=false){
    const matches:number[] = []
    let parentheses = 0
    let brackets = 0
    let quote:string|null = null
    for(let index=0;index<=text.length-operator.length;index++){
        const char = text[index]
        if(quote){
            if(char==='\\'){
                index++
            }else if(char===quote){
                quote = null
            }
            continue
        }
        if(char==="'"||char==='"'){
            quote = char
        }else if(char==='('){
            parentheses++
        }else if(char===')'){
            parentheses--
        }else if(char==='['){
            brackets++
        }else if(char===']'){
            brackets--
        }else if(parentheses===0&&brackets===0&&text.startsWith(operator,index)){
            matches.push(index)
            index += operator.length-1
        }
    }
    return matches.length?matches[fromRight?matches.length-1:0]:-1
}

export function findComparison(text:string){
    let parentheses = 0
    let brackets = 0
    let quote:string|null = null
    const operators = ['===','!==','==','!=','<=','>=','<','>']
    for(let index=0;index<text.length;index++){
        const char = text[index]
        if(quote){
            if(char==='\\'){
                index++
            }else if(char===quote){
                quote = null
            }
            continue
        }
        if(char==="'"||char==='"'){
            quote = char
        }else if(char==='('){
            parentheses++
        }else if(char===')'){
            parentheses--
        }else if(char==='['){
            brackets++
        }else if(char===']'){
            brackets--
        }else if(parentheses===0&&brackets===0){
            const operator = operators.find(value=>text.startsWith(value,index))
            if(operator){
                return {index,operator}
            }
        }
    }
    return null
}

export function findClosingParenthesis(text:string,open:number){
    let depth = 0
    let quote:string|null = null
    for(let index=open;index<text.length;index++){
        const char = text[index]
        if(quote){
            if(char==='\\'){
                index++
            }else if(char===quote){
                quote = null
            }
        }else if(char==="'"||char==='"'){
            quote = char
        }else if(char==='('){
            depth++
        }else if(char===')'){
            depth--
            if(depth===0){
                return index
            }
        }
    }
    throw new Error('Unclosed function call in if condition')
}