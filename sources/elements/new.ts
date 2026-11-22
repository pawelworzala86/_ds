import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Call from './call.ts'
import Data from './data.ts'
import DataElement from './dataElement.ts'

let instanceId = 0

export class New{
    static test(active:Base,tokenizer:Tokenizer):boolean|null{
        const token = tokenizer.get()
        if(token!=='new'){
            tokenizer.move(-1)
            return null
        }
        const className = tokenizer.get()
        const classType = active.getClass(className)
        if(!classType){
            throw new Error(`Unknown class "${className}" in constructor call`)
        }
        if(tokenizer.get()!=='('){
            throw new Error(`Expected '(' after class "${className}"`)
        }
        const args = tokenizer.getCallArguments()
        if(tokenizer.get()!==';'){
            tokenizer.move(-1)
        }

        const constructor = classType.getFunction('constructor')
        if(!constructor){
            if(args.length){
                throw new Error(`Class "${className}" has no constructor`)
            }
        }else if(args.length!==constructor.params.length){
            throw new Error(`Constructor for "${className}" expects ${constructor.params.length} arguments, received ${args.length}`)
        }

        let instanceName = ''
        do{
            instanceName = `__ds_new_instance_${++instanceId}`
        }while(active.getData(instanceName))

        const instance = new DataElement('let',instanceName,className,'0')
        instance.classType = className
        active.addData(instance)
        const declaration = new Data(active)
        declaration.element = instance
        active.children.push(declaration)

        if(constructor){
            const call = new Call(active)
            call.set(new Tokenizer(`${instanceName}.constructor(${args.join(',')})`))
            active.children.push(call)
        }
        return true
    }
}

export default New
