import Tokenizer from "../tokenizer.ts"
import Asm from "./../asm.ts"
import DataElement from './dataElement.ts'
import FuncElement from "./funcElement.ts"

export class Base{
    parent:Base|null
    children:Base[] = []
    DATA:DataElement[] = []
    FUNCTIONS:FuncElement[] = []
    IMPORT:any = []
    EXPORT:any = []
    constructor(parent:Base|null){
        this.parent = parent
    }
    set(tokenizer:Tokenizer){}
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
    addExport(name:string){
        this.EXPORT[name] = {name}
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
                const DATA = this.getData(key)
                EXPORT[key] = DATA
            }
        }
    }
    testChangeName(){
        for(const DATA of this.DATA){
            DATA.name = 'X_'+DATA.name
        }
        for(const FUNCTION of this.FUNCTIONS){
            FUNCTION.name = 'X_'+FUNCTION.name
        }
        for(const child of this.children){
            child.testChangeName()
        }
    }
}

export default Base