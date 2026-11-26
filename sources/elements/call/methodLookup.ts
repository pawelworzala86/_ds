import Base from '../base.ts'
import DataElement from '../dataElement.ts'
import {getClassPropertyAccess, getClassPropertyOffset} from '../clasElement.ts'
import TypePrototypeRegistry, {type PrototypeMethod} from '../typePrototype.ts'
import type FuncElement from '../funcElement.ts'

let arrayMethodId = 0

export function getMethod(active:Base,name:string) :{
        func:FuncElement
        instance:DataElement
        arrayMethod?:{array:DataElement,index:string}
    }|null{
        const arrayElementMethod = name.match(/^([a-z_$][\w.$]*)\[([^\]]+)\]\.([a-z_$][\w$]*)$/i)
        if(arrayElementMethod){
            const [,arrayName,index,methodName] = arrayElementMethod
            let array = active.getData(arrayName)
            if(!array){
                const access = getClassPropertyAccess(active,arrayName)
                if(access?.property.isArray&&access.property.classType){
                    const rootClass = access.instance.classType
                        ? active.getClass(access.instance.classType)
                        : null
                    const offset = rootClass
                        ? getClassPropertyOffset(
                            rootClass,
                            arrayName.split('.').slice(1).join('.'),
                            className=>active.getClass(className)
                        )
                        : null
                    if(offset!==null){
                        array = new DataElement(
                            'let',
                            `${access.instance.name}+${offset}`,
                            access.property.classType,
                            access.property.value??'0'
                        )
                        array.classType = access.property.classType
                        array.isArray = true
                        array.dynamicArray = access.property.dynamicArray
                        array.classPropertyDynamicArray = access.property.dynamicArray
                        array.classPropertyInstance = access.instance
                        array.classPropertyPath = access.path
                        array.classPropertyOffset = offset
                    }
                }
            }
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
        const separator = name.lastIndexOf('.')
        if(separator<1||separator===name.length-1){
            return null
        }
        const instance = active.getData(name.slice(0,separator))
        if(instance?.classType){
            const classType = active.getClass(instance.classType)
            const func = classType?.getFunction(name.slice(separator+1))
            if(func){
                return {func,instance}
            }
        }
        const receiverName = name.slice(0,separator)
        const access = getClassPropertyAccess(active,receiverName)
        if(!access?.property.classType){
            return null
        }
        const receiverClass = active.getClass(access.property.classType)
        const func = receiverClass?.getFunction(name.slice(separator+1))
        const rootClass = access.instance.classType
            ? active.getClass(access.instance.classType)
            : null
        const offset = rootClass
            ? getClassPropertyOffset(
                rootClass,
                receiverName.split('.').slice(1).join('.'),
                className=>active.getClass(className)
            )
            : null
        if(!func||offset===null){
            return null
        }
        const nestedInstance = new DataElement(
            'let',
            `${access.instance.name}+${offset}`,
            access.property.classType,
            '0'
        )
        nestedInstance.classType = access.property.classType
        nestedInstance.isProcedureLocal = true
        nestedInstance.classPropertyInstance = access.instance
        nestedInstance.classPropertyOffset = offset
        return {func,instance:nestedInstance}
    }

export function getPrototypeMethod(active:Base,name:string) :{method:PrototypeMethod,instance:DataElement,type:string}|null{
        const separator = name.lastIndexOf('.')
        if(separator<1||separator===name.length-1){
            return null
        }
        const receiverName = name.slice(0,separator)
        let instance = active.getData(receiverName)
        if(!instance){
            const access = getClassPropertyAccess(active,receiverName)
            if(access){
                instance = new DataElement(
                    'let',
                    `${access.instance.name}.${access.path}`,
                    access.property.type??'',
                    access.property.value??'0'
                )
                instance.declaredType = access.property.declaredType
                instance.isArray = access.property.isArray
                instance.dynamicArray = access.property.dynamicArray
                instance.classPropertyDynamicArray = access.property.dynamicArray
                instance.classType = access.property.classType
                instance.numericKind = access.property.numericKind
                instance.classPropertyInstance = access.instance
                instance.classPropertyPath = access.path
                const classType = access.instance.classType
                    ? active.getClass(access.instance.classType)
                    : null
                instance.classPropertyOffset = classType
                    ? getClassPropertyOffset(
                        classType,
                        receiverName.split('.').slice(1).join('.'),
                        name=>active.getClass(name)
                    )
                    : null
            }
        }
        if(!instance){
            return null
        }
        const type = instance.declaredType
            ??(instance.isArray
                ? 'array'
                : instance.classType
                ? `class:${instance.classType}`
                : instance.type??'')
        const method = TypePrototypeRegistry.resolve(type,name.slice(separator+1))
        return method?{method,instance,type}:null
    }
