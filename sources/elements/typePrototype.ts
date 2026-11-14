import type FuncElement from './funcElement.ts'

export type PrototypeMethod =
    | {kind:'builtin',name:string}
    | {kind:'function',func:FuncElement}

export class TypePrototypeRegistry{
    private static readonly methods = new Map<string,Map<string,PrototypeMethod>>()

    static reset(){
        this.methods.clear()
        this.registerBuiltin('array','push')
    }

    static normalize(type:string){
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
        return this.methods.get(this.normalize(type))?.get(name)??null
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

TypePrototypeRegistry.registerBuiltin('array','push')

export default TypePrototypeRegistry
