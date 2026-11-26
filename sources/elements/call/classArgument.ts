import Base from '../base.ts'
import DataElement from '../dataElement.ts'
import FunctionArgument from '../functionArgument.ts'

export function getClassArgumentCode(
    argument:FunctionArgument,
    expectedType:string|undefined,
    scope:Base
):string|null{
    const value = argument.value
    if(!(value instanceof DataElement)
        ||!value.classType
        ||value.isArray
        ||argument.classPropertyInstance
        ||!expectedType){
        return null
    }

    let classType = scope.getClass(value.classType)
    while(classType&&classType.name!==expectedType){
        classType = classType.parentClass
    }
    if(!classType){
        return null
    }

    if(value.isParameter){
        return argument.getCode(true)
    }
    return value.isHeapAllocated
        ? `[${value.name}]`
        : `addr ${value.name}`
}
