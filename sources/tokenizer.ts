export class Tokenizer{
    original:string
    tokens:string[] = []
    index:number = 0
    constructor(text:string){
        this.original = text
        this.tokens = text.split(/\ |\r|\t|(\n)|(\:)|(\()|(\))|(\')|(\")/gm).filter(t=>t)
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
        for(let index=this.index;index<this.tokens.length;index++){
            if(this.tokens[index]=='{'){
                open++
            }else if(this.tokens[index]=='}'){
                open--
                if(open==0){
                    tokens.push('}')
                    this.index = index
                    return tokens
                }
            }
            tokens.push(this.tokens[index])
        }
        return tokens
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
    static getFunctionParams(tokens:string[]){
        let openP = false
        let params = []
        for(let i=0;i<tokens.length;i+=2){
            const token = tokens[i]
            if(token=='('){
                openP = true
                continue
            }
            if(token==')'){
                break
            }
            if(openP){
                params.push({name:tokens[i-1],type:tokens[i+1]})
            }
        }
        return params
    }
}

export default Tokenizer