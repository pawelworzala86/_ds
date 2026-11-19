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

type ModuleExport =
    | {kind:'external'}
    | {kind:'class'}
    | {kind:'symbol',name:string}

type ModuleRecord = {
    source:string
    status:'compiling'|'compiled'
    exports:Map<string,ModuleExport>
}

const moduleCache = new WeakMap<Asm,Map<string,ModuleRecord>>()

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
        let files = moduleCache.get(ASM)
        if(!files){
            files = new Map<string,ModuleRecord>()
            moduleCache.set(ASM,files)
        }
        let module = files.get(file)
        const isNewModule = !module
        if(module?.status==='compiling'){
            throw new Error(`Circular import detected for "${file}"`)
        }
        if(!module){
            const source = fs.readFileSync(file).toString()+'\n'
            module = {source,status:'compiling',exports:new Map<string,ModuleExport>()}
            files.set(file,module)
            const newTokenizer = new Tokenizer(source)
            Make.compile(ASM,this.parent!,newTokenizer,file)
        }
        const source = module.source

        let alias = tokens[1]
        if(tokens[1]=='*'){
            alias = tokens[3]
        }
        //console.log('tokens',tokens)

        const exportNames = Array.from(Tokenizer.removeComments(source).matchAll(/^\s*export\s+(?:(declare\s+function)|function|class|interface|let|var|const)\s+([a-z_$][\w$]*)/gmi),match=>({
            name:match[2],
            external:Boolean(match[1])
        }))
        for(const {name:exportName,external} of exportNames){
            const cachedExport = module.exports.get(exportName)
            if(!isNewModule){
                if(!cachedExport){
                    throw new Error(`Unable to resolve imported export "${exportName}" from "${file}"`)
                }
                if(cachedExport.kind==='external'){
                    tokenizer.replace(alias+'.'+exportName,exportName)
                }else if(cachedExport.kind==='class'){
                    tokenizer.replace(alias+'.'+exportName+'[]',exportName+'[]')
                    tokenizer.replace(alias+'.'+exportName,exportName)
                }else{
                    tokenizer.replace(alias+'.'+exportName,cachedExport.name)
                }
                continue
            }
            if(external){
                module.exports.set(exportName,{kind:'external'})
                tokenizer.replace(alias+'.'+exportName,exportName)
                continue
            }
            const data = this.getData(exportName)
            const func = this.getFunction(exportName)
            const classType = this.getClass(exportName)
            if(classType){
                module.exports.set(exportName,{kind:'class'})
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
            module.exports.set(exportName,{kind:'symbol',name:internalName})
            tokenizer.replace(alias+'.'+exportName,internalName)
        }
        module.status = 'compiled'
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