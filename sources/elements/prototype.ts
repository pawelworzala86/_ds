import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Make from '../make.ts'
import Asm from '../asm.ts'
import Func from './func.ts'
import TypePrototypeRegistry from './typePrototype.ts'

export class Prototype extends Base{
    type:string|null = null

    constructor(parent:Base){
        super(parent)
    }

    set(tokenizer:Tokenizer,ASM:Asm){
        const tokens = tokenizer.getBlock()
        const type = tokens[1]?.toLowerCase()
        if(!['number','string','array'].includes(type)){
            throw new Error(`Unknown prototype type "${tokens[1]}"`)
        }
        this.type = type
        const bodyStart = tokens.indexOf('{')
        const bodyEnd = tokens.lastIndexOf('}')
        if(bodyStart===-1||bodyEnd===-1){
            throw new Error(`Prototype "${type}" is missing a body`)
        }
        const bodyTokenizer = new Tokenizer('')
        bodyTokenizer.tokens = tokens.slice(bodyStart+1,bodyEnd)
        Make.compile(ASM,this,bodyTokenizer,null)
        for(const child of this.children){
            if(!(child instanceof Func)||!child.element?.name){
                throw new Error(`Only functions can be declared in prototype "${type}"`)
            }
            const receiverType = child.element.params[0]?.type
            const validReceiver = type==='array'
                ? /^[a-z_$][\w$]*\[\]$/i.test(receiverType??'')
                : receiverType?.toLowerCase()===type
            if(!validReceiver){
                throw new Error(`Prototype method "${child.element.name}" must declare its first parameter as ${type==='array'?'an array type':`"${type}"`}`)
            }
            const functionName = child.element.name
            child.element.name = `__ds_proto_${type}_${functionName}`
            TypePrototypeRegistry.registerFunction(type,functionName,child.element)
        }
    }

    static test(active:Base,tokenizer:Tokenizer,ASM:Asm){
        const token = tokenizer.get()
        if(token==='prototype'){
            tokenizer.move(-1)
            const prototype = new Prototype(active)
            prototype.set(tokenizer,ASM)
            active.children.push(prototype)
            return prototype
        }
        tokenizer.move(-1)
        return null
    }
}

export default Prototype
