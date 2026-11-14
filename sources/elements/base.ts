import Tokenizer from "../tokenizer.ts"
import Asm from "./../asm.ts"
import DataElement from './dataElement.ts'
import FuncElement from "./funcElement.ts"
import ClassElement from "./clasElement.ts"

let ID = 0
function getID(){
    return ++ID
}

export class Base{
    parent:Base|null
    children:Base[] = []
    DATA:DataElement[] = []
    FUNCTIONS:FuncElement[] = []
    CLASSES:ClassElement[] = []
    IMPORT:any = []
    EXPORT:any = []
    constructor(parent:Base|null){
        this.parent = parent
    }
    //set(tokenizer:Tokenizer){}
    asm(ASM:Asm){
        for(const child of this.children){
            child.asm(ASM)
        }
    }
    getData(name:string):DataElement|null{
        let data = null
        for(const DATA of this.DATA){
            if(DATA.name==name){
                data = DATA
            }
        }
        if(!data){
            return this.parent?.getData(name)!
        }
        return data
    }
    addData(value:any){
        this.DATA.push(value)
    }
    getFunction(name:string):FuncElement|null{
        let func = null
        for(const FUNCTION of this.FUNCTIONS){
            if(FUNCTION.name==name){
                func = FUNCTION
            }
        }
        if(!func){
            return this.parent?.getFunction(name)!
        }
        return func
    }
    addFunction(value:any){
        this.FUNCTIONS.push(value)
    }
    getClass(name:string):ClassElement|null{
        const found = this.CLASSES.find(value=>value.name===name)
        if(found){
            return found
        }
        return this.parent?.getClass(name)??null
    }
    addClass(value:ClassElement){
        this.CLASSES.push(value)
    }
    addExport(name:string,kind:'data'|'function'|'class'='data'){
        this.EXPORT[name] = {name,kind}
    }
    getExport():any{
        if(Object.keys(this.EXPORT).length){
            return this.EXPORT
        }
        if(this.parent){
            return this.parent!.getExport()
        }else{
            return null
        }
    }
    getImport():any{
        if(Object.keys(this.IMPORT).length){
            return this.IMPORT
        }
        if(this.parent){
            return this.parent!.getImport()
        }else{
            return null
        }
    }
    linkExports(){
        const EXPORT = this.getExport()
        if(EXPORT){
            for(const key of Object.keys(EXPORT)){
                const entry = EXPORT[key]
                if(!entry||!entry.kind){
                    continue
                }
                if(entry.kind==='class'){
                    EXPORT[key] = this.getClass(entry.name)
                }else if(entry.kind==='function'){
                    EXPORT[key] = this.getFunction(entry.name)
                }else{
                    EXPORT[key] = this.getData(entry.name)
                }
            }
        }
    }
    testChangeName(){
        for(const DATA of this.DATA){
            if(!DATA.isParameter){
                DATA.name = 'X'+getID()+'_'+DATA.name
            }
        }
        for(const FUNCTION of this.FUNCTIONS){
            FUNCTION.name = 'X'+getID()+'_'+FUNCTION.name
        }
        for(const child of this.children){
            child.testChangeName()
        }
    }
}

export default Base