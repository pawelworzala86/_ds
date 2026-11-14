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

export function getClassPropertyOffset(classType:ClassElement,propertyName:string){
    const propertyIndex = classType.props.findIndex(prop=>prop.name===propertyName)
    if(propertyIndex===-1){
        return null
    }
    let offset = 0
    for(let index=0;index<propertyIndex;index++){
        const previous = classType.props[index]
        const previousSize = previous.type==='string'
            ? Math.max(8,(previous.value?.length??0)+1)
            : previous.isArray
                ? 8 * Math.max(1,(previous.value?.split(',').filter(Boolean).length??1))
                : 8
        offset += previousSize
    }
    return offset
}

export default ClassElement