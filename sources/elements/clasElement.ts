import DataElement from './dataElement.ts'
import FuncElement from './funcElement.ts'

export class ClassElement{
    name:string|null = null
    props:DataElement[]
    funcs:FuncElement[]
    constructor(name:string,props:DataElement[],funcs:FuncElement[]){
        this.name = name
        this.props = props
        this.funcs = funcs
    }
    getCode(){
        return this.name
    }
    getFunction(name:string){
        return this.funcs.find(func=>func.name===name)??null
    }
}

export default ClassElement