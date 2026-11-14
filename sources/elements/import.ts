import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import fs from 'fs'
import Make from '../make.ts'

export class Import extends Base{
    static symbolID = 0
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

        let alias = tokens[1]
        if(tokens[1]=='*'){
            alias = tokens[3]
        }
        //console.log('tokens',tokens)

        const EXPORT = this.getExport()
        if(Object.keys(EXPORT).length){
            for(const key of Object.keys(EXPORT)){
                const EXP = EXPORT[key]
                const exportName = EXP.name
                //console.log('EXP',EXP)
                let data:any = this.getData(exportName)
                if(!data){
                    data = this.getFunction(exportName)
                }
                if(!data){
                    throw new Error(`Unable to resolve imported export "${exportName}"`)
                }
                let internalName = ''
                do{
                    internalName = `__import_${++Import.symbolID}_${exportName}`
                }while(
                    tokenizer.tokens.includes(internalName) ||
                    this.getData(internalName) ||
                    this.getFunction(internalName)
                )
                data.name = internalName
                const replaceName = alias+'.'+exportName
                tokenizer.replace(replaceName, internalName)
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