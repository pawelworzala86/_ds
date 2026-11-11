import Tokenizer from "./tokenizer.ts"

export class Make{
    tokenizer:Tokenizer
    constructor(source:string){
        this.tokenizer = new Tokenizer(source)
    }
    compile(){
        const {tokenizer} = this
        while(tokenizer.has()){
            const token = tokenizer.get()
            console.log(token)
            if(['let','var','const'].includes(token)){
                console.log('DATASET')
            }
        }
    }
}

export default Make