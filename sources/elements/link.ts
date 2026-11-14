import Base from "./base.ts";
import DataElement from "./dataElement.ts";
import FuncElement from "./funcElement.ts";

export class Link{
    static data(active:Base,name:string){
        const data:DataElement|null = active.getData(name)
        if(data){
            return data
        }
        const func:FuncElement|null = active.getFunction(name)
        if(func){
            return func
        }
        return name
    }
}

export default Link