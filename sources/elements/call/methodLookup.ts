import Base from '../base.ts'
import DataElement from '../dataElement.ts'
import TypePrototypeRegistry, {type PrototypeMethod} from '../typePrototype.ts'
import type FuncElement from '../funcElement.ts'

let arrayMethodId = 0

export function getMethod(active:Base,name:string) :{
        func:FuncElement
        instance:DataElement
        arrayMethod?:{array:DataElement,index:string}
    }|null{
        const arrayElementMethod = name.match(/^([a-z_$][\w$]*)\[([^\]]+)\]\.([a-z_$][\w$]*)$/i)
        if(arrayElementMethod){
            const [,arrayName,index,methodName] = arrayElementMethod
            const array = active.getData(arrayName)
            if(!array?.isArray||!array.classType){
                return null
            }
            const classType = active.getClass(array.classType)
            const func = classType?.getFunction(methodName)
            if(!func){
                return null
            }
            const instance = new DataElement(
                'let',
                `__ds_array_method_instance_${++arrayMethodId}`,
                array.classType,
                '0'
            )
            instance.classType = array.classType
            instance.isProcedureLocal = true
            instance.isHeapAllocated = true
            return {func,instance,arrayMethod:{array,index}}
        }
        const separator = name.indexOf('.')
        if(separator<1||separator===name.length-1){
            return null
        }
        const instance = active.getData(name.slice(0,separator))
        if(!instance?.classType){
            return null
        }
        const classType = active.getClass(instance.classType)
        const func = classType?.getFunction(name.slice(separator+1))
        return func?{func,instance}:null
    }

export function getPrototypeMethod(active:Base,name:string) :{method:PrototypeMethod,instance:DataElement,type:string}|null{
        const separator = name.lastIndexOf('.')
        if(separator<1||separator===name.length-1){
            return null
        }
        const instance = active.getData(name.slice(0,separator))
        if(!instance){
            return null
        }
        const type = instance.isArray
            ? 'array'
            : instance.classType
                ? `class:${instance.classType}`
                : instance.type??''
        const method = TypePrototypeRegistry.resolve(type,name.slice(separator+1))
        return method?{method,instance,type}:null
    }
