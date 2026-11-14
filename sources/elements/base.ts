import Tokenizer from "../tokenizer.ts"
import Asm from "./../asm.ts"

export class Base{
    parent:Base|null
    children:Base[] = []
    DATA:any = []
    FUNCTIONS:any = []
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
    getData(name:string):any{
        const data = this.DATA[name]
        if(!data){
            return this.parent?.getData(name)
        }
        return data
    }
    setData(name:string,value:any){
        this.DATA[name] = value
    }
    getFunction(name:string):any{
        const func = this.FUNCTIONS[name]
        if(!func){
            return this.parent?.getFunction(name)
        }
        return func
    }
    setFunction(name:string,value:any){
        this.FUNCTIONS[name] = value
        console.log(this.FUNCTIONS)
    }
    testChangeName(){
        for(const key of Object.keys(this.DATA)){
            const DATA = this.DATA[key]
            DATA.name = 'X_'+DATA.name
        }
        for(const key of Object.keys(this.FUNCTIONS)){
            const FUNCTION = this.FUNCTIONS[key]
            FUNCTION.name = 'X_'+FUNCTION.name
        }
        for(const child of this.children){
            child.testChangeName()
        }
    }
}

export default Base