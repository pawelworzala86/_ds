export class Tokenizer{
    original:string
    tokens:string[] = []
    index:number = 0
    constructor(text:string){
        this.original = text
        this.tokens = text.split(/\ |\r|\t|(\n)/gm)
    }
    get(index:number|null=null){
        if(index){
            return this.tokens[index]
        }
        return this.tokens[this.index++]
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