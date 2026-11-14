import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import fs from 'fs'
import Make from '../make.ts'
import path from 'path'
import Asm from '../asm.ts'

function getPath(path:string){
    path = path.replace(/[a-zA-Z0-9\_]+\.ts$/gm,'')
    return path
}

export class Import extends Base{
    static symbolID = 0
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer,filePath:string|null=null,ASM:Asm){
        let tokens:string[] = []
        let token:any
        while(!['\n'].includes(token = tokenizer.get())){
            tokens.push(token)
        }
        //console.log('tokens',tokens)
        const fp = tokens[tokens.length-2]
        //console.log('filePath',fp)

        const pth = getPath(filePath!)
        //console.log('path',pth)

        const file = path.resolve(pth + fp)
        const source = fs.readFileSync(file).toString()+'\n'
        const newTokenizer = new Tokenizer(source)
        Make.compile(ASM,this.parent!,newTokenizer,file)

        let alias = tokens[1]
        if(tokens[1]=='*'){
            alias = tokens[3]
        }
        //console.log('tokens',tokens)

        const exportNames = Array.from(source.matchAll(/^\s*export\s+(?:(declare\s+function)|function|class|let|var|const)\s+([a-z_$][\w$]*)/gmi),match=>({
            name:match[2],
            external:Boolean(match[1])
        }))
        for(const {name:exportName,external} of exportNames){
            if(external){
                tokenizer.replace(alias+'.'+exportName,exportName)
                continue
            }
            const data = this.getData(exportName)
            const func = this.getFunction(exportName)
            const classType = this.getClass(exportName)
            if(classType){
                tokenizer.replace(alias+'.'+exportName+'[]',exportName+'[]')
                tokenizer.replace(alias+'.'+exportName,exportName)
                continue
            }
            if(!data&&!func){
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
            const symbol = data??func!
            symbol.name = internalName
            tokenizer.replace(alias+'.'+exportName,internalName)
        }
    }
    static test(active:Base,tokenizer:Tokenizer,filePath:string|null=null,ASM:Asm){
        const token = tokenizer.get()
        if(['import'].includes(token)){
            tokenizer.move(-1)
            const data = new Import(active)
            data.set(tokenizer,filePath,ASM)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Import