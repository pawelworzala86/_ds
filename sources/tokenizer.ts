export class Tokenizer{
    original:string
    tokens:string[] = []
    index:number = 0
    constructor(text:string){
        this.original = text
        this.tokens = text.split(/\ |\r|\t|(\n)|(\:)|(\()|(\))/gm).filter(t=>t)
        console.log(this.tokens)
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
                    return tokens
                }
            }else{
                tokens.push(this.tokens[index])
            }
        }
        return tokens
    }
}

export default Tokenizer