export class Tokenizer{
    original:string
    tokens:string[] = []
    index:number = 0
    constructor(text:string){
        this.original = text
        this.tokens = text.split(/\ |\r|\t|(\n)|(\:)|(\()|(\))|(\')|(\")|(\{)|(\})/gm).filter(t=>t)
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