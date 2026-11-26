import type FuncElement from './funcElement.ts'

export type PrototypeMethod =
    | {kind:'builtin',name:string}
    | {kind:'function',func:FuncElement}

export type ResolvedType = {
    type:string
    isArray:boolean
    declaredType:string|null
    numericKind:'integer'|'float'|null
}

export class TypePrototypeRegistry{
    private static readonly methods = new Map<string,Map<string,PrototypeMethod>>()
    private static readonly types = new Map<string,string>()

    static reset(){
        this.methods.clear()
        this.types.clear()
        this.registerBuiltins()
    }

    private static registerBuiltins(){
        this.registerBuiltin('array','push')
        this.registerBuiltin('array','forEach')
        this.registerBuiltin('array','toString')
        this.registerBuiltin('ArrayBuffer','toString')
        this.registerBuiltin('string','charCodeAt')
        this.registerBuiltin('string','split')
        this.registerBuiltin('string','replace')
        this.registerBuiltin('string','replaceAll')
        this.registerBuiltin('string','indexOf')
        this.registerBuiltin('string','includes')
        this.registerBuiltin('string','startsWith')
        this.registerBuiltin('string','endsWith')
        this.registerBuiltin('string','substring')
        this.registerBuiltin('string','slice')
        this.registerBuiltin('string','concat')
        this.registerBuiltin('string','toUpperCase')
        this.registerBuiltin('string','toLowerCase')
        this.registerBuiltin('string','toLocaleUpperCase')
        this.registerBuiltin('string','toLocaleLowerCase')
        this.registerBuiltin('string','trim')
        this.registerBuiltin('string','trimStart')
        this.registerBuiltin('string','trimEnd')
        this.registerBuiltin('string','repeat')
        this.registerBuiltin('Promise','then')
        this.registerBuiltin('Promise','catch')
    }

    static predeclareTypes(tokens:string[]){
        let depth = 0
        for(let index=0;index<tokens.length;index++){
            const token = tokens[index]
            if(depth===0&&token==='type'&&/^[a-z_$][\w$]*$/i.test(tokens[index+1]??'')&&tokens[index+2]==='='){
                const name = tokens[index+1]
                let end = index+3
                while(end<tokens.length&&tokens[end]!=='\n'&&tokens[end]!==';'){
                    end++
                }
                const target = tokens.slice(index+3,end).join('')
                this.registerType(name,target)
                index = end
                continue
            }
            if(token==='{'){
                depth++
            }else if(token==='}'){
                depth--
            }
        }
        for(const name of this.types.keys()){
            this.resolveType(name)
        }
    }

    static registerType(name:string,target:string){
        if(!/^[a-z_$][\w$]*$/i.test(name)||!target){
            throw new Error(`Invalid type declaration "${name}"`)
        }
        const key = name.toLowerCase()
        if(this.types.has(key)||['any','number','float','string','boolean','array','promise','arraybuffer'].includes(key)){
            throw new Error(`Type "${name}" is already defined`)
        }
        this.types.set(key,target)
    }

    static hasType(name:string){
        return this.types.has(name.toLowerCase())
    }

    static isDeclaredType(name:string,target:string){
        return this.types.get(name.toLowerCase())===target
    }

    static resolveType(type:string):ResolvedType{
        const original = type.trim()
        const originalArray = original.endsWith('[]')
        let value = originalArray?original.slice(0,-2):original
        if(value.endsWith('[]')){
            throw new Error(`Nested array type "${original}" is not supported`)
        }
        const declaredType = this.hasType(value)?value:null
        let isArray = originalArray
        let numericKind:'integer'|'float'|null = null
        const seen = new Set<string>()
        while(this.hasType(value)){
            const key = value.toLowerCase()
            if(seen.has(key)){
                throw new Error(`Circular type alias "${original}"`)
            }
            seen.add(key)
            const target = this.types.get(key)!
            if(target.endsWith('[]')){
                if(isArray){
                    throw new Error(`Nested array type "${original}" is not supported`)
                }
                isArray = true
                value = target.slice(0,-2)
            }else{
                value = target
            }
        }
        if(value.toLowerCase()==='float'){
            value = 'number'
            numericKind = 'float'
        }
        if(isArray){
            return {type:value,isArray,declaredType,numericKind}
        }
        return {type:value,isArray:false,declaredType,numericKind}
    }

    static normalize(type:string){
        if(/^promise(?:<.*>)?$/i.test(type)){
            return 'promise'
        }
        const normalized = type.toLowerCase()
        return normalized==='array[]'?'array':normalized
    }

    static registerBuiltin(type:string,name:string){
        this.register(type,name,{kind:'builtin',name})
    }

    static registerFunction(type:string,name:string,func:FuncElement){
        this.register(type,name,{kind:'function',func})
    }

    static resolve(type:string,name:string){
        const normalized = this.normalize(type)
        const exact = this.methods.get(normalized)?.get(name)
        if(exact){
            return exact
        }
        const alias = this.types.get(normalized)
        if(!alias){
            return null
        }
        const resolved = this.resolveType(type)
        const fallbackType = resolved.isArray
            ? 'array'
            : this.isClassAlias(type)
                ? `class:${resolved.type}`
                : resolved.type
        return this.methods.get(this.normalize(fallbackType))?.get(name)??null
    }

    static isClassAlias(type:string){
        return this.hasType(type)&&![
            'number','float','string','boolean','array','any','arraybuffer','promise','task','function','bigint','null','undefined'
        ].includes(
            this.resolveType(type).type.toLowerCase()
        )
    }

    private static register(type:string,name:string,method:PrototypeMethod){
        const normalized = this.normalize(type)
        let methods = this.methods.get(normalized)
        if(!methods){
            methods = new Map<string,PrototypeMethod>()
            this.methods.set(normalized,methods)
        }
        if(methods.has(name)){
            throw new Error(`Prototype method "${normalized}.${name}" is already defined`)
        }
        methods.set(name,method)
    }
}

TypePrototypeRegistry.reset()

export default TypePrototypeRegistry
