import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Make from './../make.ts'
import Asm from "./../asm.ts"
import ClassElement from './clasElement.ts'
import Func from './func.ts'

export class Class extends Base{
    element:ClassElement|null = null
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer,ASM:Asm){
        let tokens:string[] = tokenizer.getBlock()
        const name = tokens[1]
        const parentClassName = tokens[2]==='extends'?tokens[3]:null
        const parentClass = parentClassName?this.parent!.getClass(parentClassName):null
        if(parentClassName&&!parentClass){
            throw new Error(`Unknown parent class "${parentClassName}" for class "${name}"`)
        }
        const bodyStart = tokens.indexOf('{')
        const bodyEnd = tokens.lastIndexOf('}')
        if(bodyStart===-1||bodyEnd===-1){
            throw new Error(`Class "${name}" is missing a body`)
        }
        tokens = tokens.slice(bodyStart+1,bodyEnd)
        const element = new ClassElement(name,this.DATA,this.FUNCTIONS,parentClass)
        this.element = element
        this.classElement = element
        this.parent!.addClass(element)
        const tokenizer2 = new Tokenizer('')
        tokenizer2.tokens = tokens
        Make.compile(ASM,this,tokenizer2,null)

        element.props = [...(parentClass?.props??[]),...this.DATA]
        element.methodNodes = this.children
            .filter((child):child is Func=>child instanceof Func)
            .map(method=>({element:method.element,getStructCode:asm=>method.getStructCode(asm)}))
    }
    asm(ASM:Asm){
        const props:string[] = []
        const addProperties = (classType:ClassElement,prefix='')=>{
            for(const prop of classType.props){
                if(prop.classType&&!prop.isArray){
                    const nestedClass = this.parent?.getClass(prop.classType)
                    if(!nestedClass){
                        throw new Error(`Unknown class type "${prop.classType}" for property "${prop.name}"`)
                    }
                    addProperties(nestedClass,`${prefix}${prop.name}_`)
                    continue
                }
                const name = `${prefix}${prop.name}`
                const value = prop.type==='string'?'0':prop.value||'0'
                const type = 'dq'
                props.push(`    ${name} ${type} ${value}`)
            }
        }
        addProperties(this.element!)
        const ownMethods = this.children
            .filter((child):child is Func=>child instanceof Func)
            .map(method=>({name:method.element?.name??'',getCode:()=>method.getStructCode(ASM)}))
        const methodNames = new Set(ownMethods.map(method=>method.name))
        const inheritedMethods:{name:string,getCode:()=>string}[] = []
        let parentClass = this.element!.parentClass
        while(parentClass){
            for(const method of parentClass.methodNodes){
                const methodName = method.element?.name??''
                if(methodName&&!methodNames.has(methodName)){
                    methodNames.add(methodName)
                    inheritedMethods.push({name:methodName,getCode:()=>method.getStructCode(ASM)})
                }
            }
            parentClass = parentClass.parentClass
        }
        const methods = [...ownMethods,...inheritedMethods].map(method=>method.getCode())
        ASM.addCode([`struct ${this.element!.name}`,...props,...methods,'end struct'].join('\n'))
    }
    testChangeName(){
        for(const child of this.children){
            child.testChangeName()
        }
    }
    static test(active:Base,tokenizer:Tokenizer,ASM:Asm){
        const token = tokenizer.get()
        if(['class','interface'].includes(token)){
            tokenizer.move(-1)
            const data = new Class(active)
            data.set(tokenizer,ASM)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Class