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
            if(char==='"'||char==="'"){
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
            if(char==='"'||char==="'"){
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
    static getFunctionParams(tokens:string[]):{name:string,type:string}[]{
        const open = tokens.indexOf('(')
        const close = tokens.indexOf(')',open+1)
        if(open===-1||close===-1){
            return []
        }
        const signature = tokens.slice(open+1,close).join('')
        if(!signature){
            return []
        }
        return signature.split(',').map((param:string)=>{
            const [name,...type] = param.split(':')
            return {name,type:type.join(':')}
        })
    }
}

export default Tokenizer