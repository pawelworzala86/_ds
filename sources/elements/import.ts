import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import fs from 'fs'
import Make from '../make.ts'

export class Import extends Base{
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        let tokens:string[] = []
        let token:any
        while(!['\n'].includes(token = tokenizer.get())){
            tokens.push(token)
        }
        const source = fs.readFileSync('./examples/inc.ts').toString()+'\n'
        const newTokenizer = new Tokenizer(source)
        Make.compile(this.parent!,newTokenizer)

        const EXPORT = this.getExport()
        if(Object.keys(EXPORT).length){
            for(const key of Object.keys(EXPORT)){
                const EXP = EXPORT[key]
                const data = this.getData('testVar')
                tokenizer.replace('inc.testVar',data!.name!)
            }
        }
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(['import'].includes(token)){
            tokenizer.move(-1)
            const data = new Import(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Import