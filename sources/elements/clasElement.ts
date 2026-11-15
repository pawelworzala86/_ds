import DataElement from './dataElement.ts'
import FuncElement from './funcElement.ts'
import type Base from './base.ts'

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

export function getClassPropertyOffset(classType:ClassElement,propertyName:string,getClass?:((name:string)=>ClassElement|null)){
    let offset = 0
    let currentClass = classType
    const properties = propertyName.split('.')
    for(let pathIndex=0;pathIndex<properties.length;pathIndex++){
        const propertyIndex = currentClass.props.findIndex(prop=>prop.name===properties[pathIndex])
        if(propertyIndex===-1){
            return null
        }
        for(let index=0;index<propertyIndex;index++){
            offset += getClassPropertySize(currentClass.props[index],getClass)
        }
        const property = currentClass.props[propertyIndex]
        if(pathIndex===properties.length-1){
            return offset
        }
        if(!property.classType||property.isArray){
            return null
        }
        const nestedClass = getClass?.(property.classType)??null
        if(!nestedClass){
            return null
        }
        currentClass = nestedClass
    }
    return null
}

function getClassPropertySize(property:DataElement,getClass?:((name:string)=>ClassElement|null)):number{
    if(property.classType&&!property.isArray){
        const nestedClass = getClass?.(property.classType)??null
        if(nestedClass){
            return nestedClass.props.reduce((size,member)=>size+getClassPropertySize(member,getClass),0)
        }
    }
    if(property.type==='string'){
        return 8
    }
    if(property.isArray){
        return 8*Math.max(1,(property.value?.split(',').filter(Boolean).length??1))
    }
    return 8
}

export function getClassPropertyAccess(active:Base,name:string):{instance:DataElement,property:DataElement,path:string}|null{
    const parts = name.split('.')
    if(parts.length<2){
        return null
    }
    const instance = active.getData(parts[0])
    let classType = instance?.classType?active.getClass(instance.classType):null
    if(!instance||!classType){
        return null
    }
    let property:DataElement|null = null
    for(let index=1;index<parts.length;index++){
        property = classType.props.find(prop=>prop.name===parts[index])??null
        if(!property){
            return null
        }
        if(index<parts.length-1){
            if(!property.classType||property.isArray){
                return null
            }
            classType = active.getClass(property.classType)
            if(!classType){
                return null
            }
        }
    }
    return property?{instance,property,path:parts.slice(1).join('_')}:null
}

export default ClassElement