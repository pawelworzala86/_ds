import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import TypePrototypeRegistry from './typePrototype.ts'

export class TypeDeclaration extends Base{
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(token!=='type'){
            tokenizer.move(-1)
            return null
        }
        if(active.parent){
            throw new Error('Type declarations must be at the top level')
        }
        const name = tokenizer.get()
        const equals = tokenizer.get()
        if(equals!=='='){
            throw new Error('Invalid type declaration')
        }
        const target:string[] = []
        while(tokenizer.has()){
            const next = tokenizer.get()
            if(next==='\n'||next===';'){
                break
            }
            target.push(next)
        }
        const resolvedTarget = target.join('')
        if(!TypePrototypeRegistry.isDeclaredType(name,resolvedTarget)){
            throw new Error(`Type "${name}" was not registered`)
        }
        return new TypeDeclaration(active)
    }

    asm(){
    }
}

export default TypeDeclaration
