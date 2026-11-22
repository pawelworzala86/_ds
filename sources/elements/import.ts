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
    | {kind:'external',name:string}
    | {kind:'class',name:string}
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

        const isNamespaceImport = tokens[1]==='*'
        const isDefaultImport = !isNamespaceImport&&tokens[2]==='from'
        let alias = tokens[1]
        if(isNamespaceImport){
            alias = tokens[3]
        }
        const cleanSource = Tokenizer.removeComments(source)
        const namedExports = Array.from(cleanSource.matchAll(/^\s*export\s+(?:(declare\s+function)|function|class|interface|let|var|const)\s+([a-z_$][\w$]*)/gmi),match=>({
            name:match[2],
            targetName:match[2],
            external:Boolean(match[1])
        }))
        const defaultExport = cleanSource.match(/^\s*export\s+default\s+(?:(class|function)\s+([a-z_$][\w$]*)|([a-z_$][\w$]*))\b/gmi)
        const defaultTarget = defaultExport?.[0].match(/(?:class|function)\s+([a-z_$][\w$]*)\b|default\s+([a-z_$][\w$]*)\b/i)
        const defaultName = defaultTarget?.[1]??defaultTarget?.[2]
        const exportNames = isDefaultImport
            ? defaultName?[{name:'default',targetName:defaultName,external:false}]:[]
            : namedExports
        if(isNamespaceImport&&defaultName){
            exportNames.push({name:'default',targetName:defaultName,external:false})
        }
        for(const {name:exportName,targetName,external} of exportNames){
            const cachedExport = module.exports.get(exportName)
            if(!isNewModule){
                if(!cachedExport){
                    throw new Error(`Unable to resolve imported export "${exportName}" from "${file}"`)
                }
                const importedName = isDefaultImport?alias:`${alias}.${exportName}`
                if(cachedExport.kind==='external'){
                    tokenizer.replace(importedName,cachedExport.name)
                }else if(cachedExport.kind==='class'){
                    tokenizer.replace(importedName+'[]',cachedExport.name+'[]')
                    tokenizer.replace(importedName,cachedExport.name)
                }else{
                    tokenizer.replace(importedName,cachedExport.name)
                }
                continue
            }
            let exported:ModuleExport
            if(external){
                exported = {kind:'external',name:targetName}
            }else{
                const data = this.getData(targetName)
                const func = this.getFunction(targetName)
                const classType = this.getClass(targetName)
            if(classType){
                    exported = {kind:'class',name:targetName}
                }else if(data||func){
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
                    exported = {kind:'symbol',name:internalName}
                }else{
                    throw new Error(`Unable to resolve imported export "${exportName}"`)
                }
            }
            module.exports.set(exportName,exported)
            const importedName = isDefaultImport?alias:`${alias}.${exportName}`
            if(exported.kind==='class'){
                tokenizer.replace(importedName+'[]',exported.name+'[]')
            }
            tokenizer.replace(importedName,exported.name)
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