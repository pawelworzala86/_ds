import type DataElement from '../dataElement.ts'
import type ClassElement from '../clasElement.ts'
import type {JsonValue} from '../dataElement.ts'

export type ObjectLiteralProperty = {
    name:string
    type:string
    value:string
    classType?:string
    isArray?:boolean
    dynamicArray?:boolean
    arrayObjectValues?:DataElement[][]|null
    jsonValue?:JsonValue
}

export type JSONArrayLayout = {
    type:string
    values:string[]
    classType:ClassElement|null
    arrayObjectValues:DataElement[][]|null
    dynamicArray:boolean
}

