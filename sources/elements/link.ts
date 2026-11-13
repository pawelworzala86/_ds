import Base from "./base.ts";
import { DataElement } from "./data.ts";

export class Link{
    static data(active:Base,name:string){
        const data:DataElement = active.getData(name)
        if(data){
            return data
        }
        return name
    }
}

export default Link