import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import DataElement, {getNumericKind} from './dataElement.ts'
import Assign from './assign.ts'

export class Data extends Base{
    element:DataElement|null = null
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer,classField=false){
        let tokens:string[] = []
        let token:any
        while(!['\n','\;'].includes(token = tokenizer.get())){
            tokens.push(token)
        }
        let [kind,name,sep,type,eq,value] = tokens
        if(classField){
            kind = 'let'
            ;[name,sep,type,eq,value] = tokens
        }
        const arrayType = type?.match(/^([a-z_$][\w$]*)\[\]$/i)
        let arrayValues:string[] = []
        if(arrayType){
            if(arrayType[1]!=='number'||eq!=='='){
                throw new Error(`Array "${name}" must be initialized with a numeric array literal`)
            }
            const initializer = tokens.slice(classField?4:5).join('').replace(/;$/,'')
            const arrayLiteral = initializer.match(/^\[([\s\S]*)\]$/)
            if(!arrayLiteral){
                throw new Error(`Invalid array initializer for "${name}"`)
            }
            arrayValues = arrayLiteral[1].split(',').map(item=>item.trim())
            if(!arrayValues.length||arrayValues.some(item=>!item||!/^[+-]?(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(item))){
                throw new Error(`Array "${name}" must contain numeric literals`)
            }
            value = arrayValues.join(', ')
        }
        let numericExpression:string|null = null
        let runtimeInitializer = false
        if(type==='number'&&eq==='='){
            numericExpression = tokens.slice(classField?4:5).join('').replace(/;$/,'')
            runtimeInitializer = !/^[+-]?(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(numericExpression)
            if(runtimeInitializer){
                if(classField){
                    throw new Error(`Numeric expression initializer is not supported for class field "${name}"`)
                }
                value = '0'
            }else{
                value = numericExpression
            }
        }
        const classType = this.parent?.getClass(type)
        if(classType&&eq==='='&&(value!=='new'||tokens[6]!==type)){
            throw new Error(`Class instance "${name}" must be initialized with new ${type}()`)
        }
        let values = [value]
        if(type=='string'){
            let open = false
            let spec = false
            values = []
            for(const token of tokens){
                if(spec&&(token=='\'')){
                    values.push(token)
                }else if(token=='\''){
                    open = !open
                    continue
                }else if(token=='\\'){
                    spec = true
                    continue
                }
                if(open){
                    values.push(token)
                }
                spec = false
            }
        }
        this.element = new DataElement(kind,name,type,arrayType?value:values.join(' ')??'')
        if(arrayType){
            this.element.isArray = true
            this.element.numericKind = arrayValues.some(item=>getNumericKind(item)==='float')?'float':'integer'
        }
        this.element.classType = classType?.name??null
        this.parent?.addData(this.element)
        if(runtimeInitializer&&numericExpression&&this.parent){
            const initializer = new Assign(this.parent)
            initializer.setExpression(this.element,numericExpression,true)
            this.parent.children.push(initializer)
        }
    }
    asm(ASM:Asm){
        if(this.element!.classType){
            ASM.addData(`${this.element!.name} ${this.element!.classType}`)
            return
        }
        let type = 'dq'
        let value = this.element!.value
        if(this.element!.isArray){
            if(this.element!.numericKind==='float'){
                value = value!.split(',').map(item=>{
                    const literal = item.trim()
                    return getNumericKind(literal)==='integer'?`${Number(literal)}.0`:literal
                }).join(', ')
            }
            ASM.addData(`${this.element!.name} dq ${value}`)
            return
        }
        if(this.element!.type==='number'&&this.element!.numericKind==='float'&&/e/i.test(value??'')&&!/f$/i.test(value??'')){
            value += 'f'
        }
        if(this.element!.type=='string'){
            type = 'db'
            value = '\''+value+'\',0'
        }
        const data:string = `${this.element!.name} ${type} ${value}`
        ASM.addData(data)
    }
    static test(active:Base,tokenizer:Tokenizer,classField=false){
        const token = tokenizer.get()
        const next = tokenizer.get()
        tokenizer.move(-2)
        const isClassField = classField&&next===':'
        if(['let','var','const'].includes(token)||isClassField){
            const data = new Data(active)
            data.set(tokenizer,isClassField)
            active.children.push(data)
            return data
        }
        return null
    }
}

export default Data