import Base from "./base.ts";
import { DataElement } from "./data.ts";
import { FuncElement } from "./func.ts";

export class Link{
    static data(active:Base,name:string){
        const IMPORT = active.getImport()
        console.log(active)
        console.log('IMPORT:::::::::::::::::',IMPORT)
        if(IMPORT&&Object.keys(IMPORT).length){
            console.log('HAS IMPORT:::::::::::::::::',IMPORT)
            for(const key of Object.keys(IMPORT)){
                const EXP = IMPORT[key]
                const data = active.getData('testVar')
                if(data){
                    return data
                }
                //tokenizer.replace('inc.testVar',data.name)
            }
        }

        const data:DataElement = active.getData(name)
        if(data){
            return data
        }
        const func:FuncElement = active.getFunction(name)
        if(func){
            return func
        }
        return name
    }
}

export default Link