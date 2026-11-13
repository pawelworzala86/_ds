import Base from "./base.ts";
import { DataElement } from "./data.ts";
import { FuncElement, getFunction } from "./func.ts";

export class Link{
    static data(active:Base,name:string){
        const data:DataElement = active.getData(name)
        if(data){
            return data
        }
        const func:FuncElement = getFunction(name)
        if(func){
            return func
        }
        return name
    }
}

export default Link