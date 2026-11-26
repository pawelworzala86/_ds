import {parseRegExpLiteral,readRegExpLiteralAt} from './regex.ts'

export class Tokenizer{
    original:string
    tokens:string[] = []
    index:number = 0
    constructor(text:string){
        this.original = text
        this.tokens = Tokenizer.tokenize(Tokenizer.removeComments(text))
    }
    static tokenize(text:string){
        const tokens:string[] = []
        let token = ''
        let quote:string|null = null
        const pushToken = ()=>{
            if(token){
                tokens.push(token)
                token = ''
            }
        }
        for(let index=0;index<text.length;index++){
            const char = text[index]
            if(char==='`'){
                pushToken()
                let literal = char
                let escaped = false
                while(++index<text.length){
                    const current = text[index]
                    literal += current
                    if(escaped){
                        escaped = false
                    }else if(current==='\\'){
                        escaped = true
                    }else if(current==='`'){
                        break
                    }
                }
                tokens.push(literal)
                continue
            }
            if(char==='/'&&text[index+1]!=='/'&&text[index+1]!=='*'&&Tokenizer.isRegexStart(text,index)){
                const regexp = readRegExpLiteralAt(text,index)
                if(regexp){
                    pushToken()
                    tokens.push(regexp.literal)
                    index = regexp.end-1
                    continue
                }
            }
            if(quote){
                if(char==='\\'&&index+1<text.length){
                    token += char+text[++index]
                }else if(char===quote){
                    pushToken()
                    tokens.push(char)
                    quote = null
                }else{
                    token += char
                }
                continue
            }
            if(char==='"'||char==="'"||char==='`'){
                pushToken()
                tokens.push(char)
                quote = char
            }else if(char===' '||char==='\r'||char==='\t'||char==='\n'||char===':'||char==='('||char===')'||char==='{'||char==='}'||char===','||char===';'){
                pushToken()
                if(char==='\n'||char===':'||char==='('||char===')'||char==='{'||char==='}'||char===','||char===';'){
                    tokens.push(char)
                }
            }else{
                token += char
            }
        }
        pushToken()
        return tokens
    }
    static removeComments(text:string){
        let result = ''
        let quote:string|null = null
        let lineComment = false
        let blockComment = false
        let lineStart = 0
        for(let index=0;index<text.length;index++){
            const char = text[index]
            const next = text[index+1]
            if(lineComment){
                if(char==='\n'){
                    result += '\n'
                    lineComment = false
                    lineStart = index+1
                }
                continue
            }
            if(blockComment){
                if(char==='*'&&next==='/'){
                    result += ' '
                    blockComment = false
                    index++
                }else if(char==='\n'){
                    result += '\n'
                    lineStart = index+1
                }
                continue
            }
            if(quote){
                result += char
                if(char==='\\'){
                    result += text[++index]??''
                }else if(char===quote){
                    quote = null
                }
                continue
            }
            if(char==='/'&&next!=='/'&&next!=='*'&&Tokenizer.isRegexStart(text,index)){
                const regexp = readRegExpLiteralAt(text,index)
                if(regexp){
                    result += regexp.literal
                    index = regexp.end-1
                    continue
                }
            }
            if(char==='"'||char==="'"||char==='`'){
                quote = char
                result += char
            }else if(char==='/'&&next==='*'){
                result += ' '
                blockComment = true
                index++
            }else if(char==='/'&&next==='/'){
                const linePrefix = text.slice(lineStart,index)
                if(/\bdeclare\b/.test(linePrefix)&&/:\w+(?:\[\])?$/.test(linePrefix)){
                    result += '//'
                    index++
                }else{
                    result += ' '
                    lineComment = true
                    index++
                }
            }else{
                result += char
                if(char==='\n'){
                    lineStart = index+1
                }
            }
        }
        return result
    }
    static isRegexStart(text:string,index:number){
        let previous = index-1
        while(previous>=0&&/\s/.test(text[previous])){
            previous--
        }
        if(previous<0||'([{,:;=!?&|+-*%^~<>'.includes(text[previous])){
            return true
        }
        const word = text.slice(0,previous+1).match(/[a-z_$][\w$]*$/i)?.[0]
        return Boolean(word&&['return','throw','case','yield','await'].includes(word))
    }
    get(index:number|null=null){
        if(index){
            return this.tokens[index]
        }
        return this.tokens[this.index++]
    }
    move(dir:number){
        this.index += dir
    }
    has(index:number|null=null):boolean{
        if(index){
            return this.tokens[index]?true:false
        }
        return this.tokens[this.index]?true:false
    }
    getBlock(){
        let tokens:string[] = []
        let open:number = 0
        let index = this.index
        for(index=this.index;index<this.tokens.length;index++){
            if(this.tokens[index]=='{'){
                open++
            }else if(this.tokens[index]=='}'){
                open--
                if(open==0){
                    tokens.push('}')
                    this.index = index + 1
                    return tokens
                }
            }
            tokens.push(this.tokens[index])
        }
        this.index = index
        return tokens
    }
    getCallArguments(){
        const args:string[] = []
        let current = ''
        let nested = 0
        let nestedArray = 0
        let quote:string|null = null
        let lastQuotedWord = false
        const pushArg = ()=>{
            if(current.length){
                args.push(current)
            }
            current = ''
            lastQuotedWord = false
        }
        while(this.has()){
            const token = this.get()
            if(quote){
                if(token===quote){
                    current += token
                    quote = null
                    lastQuotedWord = false
                }else{
                    const isWord = /^[\w]+$/.test(token)
                    if(lastQuotedWord&&isWord){
                        current += ' '
                    }
                    current += token
                    lastQuotedWord = isWord
                }
                continue
            }
            if(token=="'"||token=='"'){
                quote = token
                current += token
                lastQuotedWord = false
                continue
            }
            if(parseRegExpLiteral(token)){
                current += token
                lastQuotedWord = false
                continue
            }
            if(token.startsWith('`')&&token.endsWith('`')){
                current += token
                lastQuotedWord = false
                continue
            }
            if(token=='('){
                nested++
                current += token
                continue
            }
            if(token==')'){
                if(nested===0){
                    pushArg()
                    return args
                }
                nested--
                current += token
                continue
            }
            if(token==='typeof'){
                if(current&&!/\s$/.test(current)){
                    current += ' '
                }
                current += 'typeof '
                continue
            }
            if(token==='instanceof'){
                current += ' instanceof '
                continue
            }
            if(token=='['){
                nestedArray++
                current += token
                continue
            }
            if(token==']'){
                nestedArray--
                current += token
                continue
            }
            let start = 0
            for(let index=0;index<token.length;index++){
                if(token[index]==='['){
                    nestedArray++
                    continue
                }
                if(token[index]===']'){
                    nestedArray--
                    continue
                }
                if(token[index]===','&&nested===0&&nestedArray===0){
                    current += token.slice(start,index)
                    pushArg()
                    start = index+1
                }
            }
            current += token.slice(start)
        }
        throw new Error('Unterminated function call')
    }
    static getParams(tokens:string[]){
        let openP = false
        let params = []
        for(const token of tokens){
            if(token=='('){
                openP = true
                continue
            }
            if(token==')'){
                break
            }
            if(openP){
                params.push(token)
            }
        }
        return params
    }
    replace(from:string,to:string){
        for(let i=0;i<this.tokens.length;i++){
            if(this.tokens[i]==from){
                this.tokens[i] = to
            }
        }
    }
    static getFunctionParams(tokens:string[]):{name:string,type:string,defaultValue?:string}[]{
        const open = tokens.indexOf('(')
        if(open===-1){
            return []
        }
        const parameters:string[][] = []
        let current:string[] = []
        let depth = 0
        let quote:string|null = null
        for(let index=open+1;index<tokens.length;index++){
            const token = tokens[index]
            if(quote){
                current.push(token)
                if(token===quote){
                    quote = null
                }
                continue
            }
            if(token==="'"||token==='"'){
                quote = token
                current.push(token)
            }else if(token==='('||token==='['||token==='{'){
                depth++
                current.push(token)
            }else if(token===')'){
                if(depth===0){
                    if(current.length){
                        parameters.push(current)
                    }
                    break
                }
                depth--
                current.push(token)
            }else if(token===']'||token==='}'){
                depth--
                current.push(token)
            }else if(token===','&&depth===0){
                parameters.push(current)
                current = []
            }else{
                current.push(token)
            }
        }
        return parameters.map(param=>{
            const signature = param.join('')
            const colon = signature.indexOf(':')
            const equals = signature.indexOf('=',colon+1)
            const name = (colon===-1?signature:signature.slice(0,colon)).replace(/\?$/,'')
            const type = colon===-1?'any':signature.slice(colon+1,equals===-1?undefined:equals)
            return {
                name,
                type,
                ...(equals===-1?{}:{defaultValue:signature.slice(equals+1)})
            }
        })
    }
}

export default Tokenizer