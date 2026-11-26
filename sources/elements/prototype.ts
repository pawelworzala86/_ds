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
        const declaredType = tokens[1]??''
        const resolvedType = TypePrototypeRegistry.resolveType(declaredType)
        const isAlias = TypePrototypeRegistry.hasType(declaredType)
        const normalizedType = declaredType.toLowerCase()
        const classType = !isAlias&&!resolvedType.isArray&&!['number','float','string','array','boolean','any','arraybuffer'].includes(normalizedType)
            ? this.parent?.getClass(declaredType)??null
            : null
        if(!isAlias&&!classType&&!resolvedType.isArray&&!['number','float','string','array','boolean','any','arraybuffer'].includes(normalizedType)){
            throw new Error(`Unknown prototype type "${tokens[1]}"`)
        }
        const type = classType
            ? `class:${classType.name}`
            : isAlias
                ? declaredType
                : resolvedType.isArray?'array':resolvedType.type.toLowerCase()
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
            if(!classType){
                const receiver = child.element.params[0]
                const receiverType = receiver?.type
                const validReceiver = isAlias
                    ? receiver?.declaredType?.toLowerCase()===declaredType.toLowerCase()
                    : resolvedType.isArray||type==='array'
                        ? /\[\]$/.test(receiverType??'')
                        : receiverType?.toLowerCase()===resolvedType.type.toLowerCase()
                if(!validReceiver){
                    throw new Error(`Prototype method "${child.element.name}" must declare its first parameter as ${isAlias?`"${declaredType}"`:resolvedType.isArray||type==='array'?'an array type':`"${resolvedType.type}"`}`)
                }
            }
            const functionName = child.element.name
            const functionType = type.replace(/[^a-z0-9_$]/gi,'_')
            child.element.name = `__ds_proto_${functionType}_${functionName}`
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
