import type FuncElement from './funcElement.ts'

export type PrototypeMethod =
    | {kind:'builtin',name:string}
    | {kind:'function',func:FuncElement}

export class TypePrototypeRegistry{
    private static readonly methods = new Map<string,Map<string,PrototypeMethod>>()

    static reset(){
        this.methods.clear()
        this.registerBuiltin('array','push')
        this.registerBuiltin('array','forEach')
        this.registerBuiltin('array','toString')
        this.registerBuiltin('ArrayBuffer','toString')
        this.registerBuiltin('string','charCodeAt')
        this.registerBuiltin('string','split')
        this.registerBuiltin('string','replace')
        this.registerBuiltin('string','indexOf')
        this.registerBuiltin('string','includes')
        this.registerBuiltin('string','startsWith')
        this.registerBuiltin('string','endsWith')
        this.registerBuiltin('string','substring')
        this.registerBuiltin('string','slice')
        this.registerBuiltin('string','concat')
        this.registerBuiltin('Promise','then')
        this.registerBuiltin('Promise','catch')
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
TypePrototypeRegistry.registerBuiltin('array','forEach')
TypePrototypeRegistry.registerBuiltin('array','toString')
TypePrototypeRegistry.registerBuiltin('ArrayBuffer','toString')
TypePrototypeRegistry.registerBuiltin('string','charCodeAt')
TypePrototypeRegistry.registerBuiltin('string','split')
TypePrototypeRegistry.registerBuiltin('string','replace')
TypePrototypeRegistry.registerBuiltin('string','indexOf')
TypePrototypeRegistry.registerBuiltin('string','includes')
TypePrototypeRegistry.registerBuiltin('string','startsWith')
TypePrototypeRegistry.registerBuiltin('string','endsWith')
TypePrototypeRegistry.registerBuiltin('string','substring')
TypePrototypeRegistry.registerBuiltin('string','slice')
TypePrototypeRegistry.registerBuiltin('string','concat')
TypePrototypeRegistry.registerBuiltin('Promise','then')
TypePrototypeRegistry.registerBuiltin('Promise','catch')

export default TypePrototypeRegistry
