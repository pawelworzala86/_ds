import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import DataElement, {getNumericKind} from './dataElement.ts'
import Assign from './assign.ts'

function splitTopLevelArrayValues(value:string):string[]{
    const items:string[] = []
    let current = ''
    let quote:string|null = null
    for(let index=0;index<value.length;index++){
        const char = value[index]
        if(quote){
            current += char
            if(char===quote && value[index-1]!=='\\'){
                quote = null
            }
            continue
        }
        if(char==="'"||char==='"'){
            quote = char
            current += char
            continue
        }
        if(char===','){
            const trimmed = current.trim()
            if(trimmed){
                items.push(trimmed)
            }
            current = ''
            continue
        }
        current += char
    }
    const trimmed = current.trim()
    if(trimmed){
        const item = trimmed.startsWith("'")&&trimmed.endsWith("'")
            ? `'${trimmed.slice(1,-1).trim()}'`
            : trimmed.startsWith('"')&&trimmed.endsWith('"')
                ? `"${trimmed.slice(1,-1).trim()}"`
                : trimmed
        items.push(item)
    }
    return items
}

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
            const itemType = arrayType[1]
            const classType = this.parent?.getClass(itemType)
            const allowedItemTypes = ['number','string']
            if((!allowedItemTypes.includes(itemType)&&!classType)||eq!=='='){
                throw new Error(`Array "${name}" must be initialized with an array literal`)
            }
            const initializerStart = tokens.indexOf('=') + 1
            const initializer = tokens.slice(initializerStart).join(' ')
                .replace(/\s+/g,' ')
                .replace(/\s*\(\s*/g,'(')
                .replace(/\s*\)\s*/g,')')
                .replace(/\s*,\s*/g,',')
                .replace(/\s*\[\s*/g,'[')
                .replace(/\s*\]\s*/g,']')
                .replace(/;$/,'')
            const arrayLiteral = initializer.match(/^\[([\s\S]*)\]$/)
            if(!arrayLiteral){
                throw new Error(`Invalid array initializer for "${name}"`)
            }
            arrayValues = splitTopLevelArrayValues(arrayLiteral[1])
            if(itemType==='number'){
                if(arrayValues.some(item=>!item||!/^[+-]?(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(item))){
                    throw new Error(`Array "${name}" must contain numeric literals`)
                }
                value = arrayValues.join(', ')
            }else if(itemType==='string'){
                if(arrayValues.some(item=>!item||!(/^'(?:\\.|[^'])*'$/.test(item)||/^"(?:\\.|[^"])*"$/.test(item)))){
                    throw new Error(`Array "${name}" must contain string literals`)
                }
                value = arrayValues.join(', ')
            }else if(classType){
                if(arrayValues.some(item=>!item||!new RegExp(`^new\\s+${itemType.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*\\(\\s*\\)$`,`i`).test(item.trim()))){
                    throw new Error(`Array "${name}" must contain "new ${itemType}()" initializers`)
                }
                value = arrayValues.join(', ')
            }
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
        const normalizedType = arrayType?arrayType[1]:type
        const classType = this.parent?.getClass(normalizedType)
        if(classType&&!arrayType&&eq==='='&&(value!=='new'||tokens[6]!==normalizedType)){
            throw new Error(`Class instance "${name}" must be initialized with new ${normalizedType}()`)
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
        this.element = new DataElement(kind,name,arrayType?arrayType[1]:type,arrayType?value:values.join(' ')??'')
        if(arrayType){
            this.element.isArray = true
            this.element.dynamicArray = arrayValues.length===0
            this.element.numericKind = arrayType[1]==='number'&&arrayValues.some(item=>getNumericKind(item)==='float')?'float':'integer'
            if(classType){
                this.element.classType = classType.name
            }
        }
        if(!arrayType){
            this.element.classType = classType?.name??null
        }
        this.parent?.addData(this.element)
        if(runtimeInitializer&&numericExpression&&this.parent){
            const initializer = new Assign(this.parent)
            initializer.setExpression(this.element,numericExpression,true)
            this.parent.children.push(initializer)
        }
    }
    asm(ASM:Asm){
        let type = 'dq'
        let value = this.element!.value
        if(this.element!.isArray){
            if(this.element!.dynamicArray){
                const values = splitTopLevelArrayValues(value??'')
                const capacity = Math.max(4,values.length)
                const lengthName = `${this.element!.name}__length`
                const capacityName = `${this.element!.name}__capacity`
                ASM.addData(`${this.element!.name} dq 0`)
                ASM.addData(`${lengthName} dq ${values.length}`)
                ASM.addData(`${capacityName} dq ${capacity}`)
                ASM.addImport('msvcrt','malloc')
                ASM.addCode(`mov rcx, ${capacity*8}`)
                ASM.addCode('sub rsp, 40')
                ASM.addCode('call [malloc]')
                ASM.addCode('add rsp, 40')
                const allocationError = `__ds_array_init_error_${this.element!.name}`
                const allocationReady = `__ds_array_init_ready_${this.element!.name}`
                ASM.addCode('test rax, rax')
                ASM.addCode(`jz ${allocationError}`)
                ASM.addCode(`mov [${this.element!.name}], rax`)
                if(this.element!.classType){
                    values.forEach((item,index)=>{
                        const label = `${this.element!.name}_${index}`
                        ASM.addData(`${label} ${this.element!.classType}`)
                        ASM.addCode(`lea rax, [${label}]`)
                        ASM.addCode(`mov rdx, [${this.element!.name}]`)
                        ASM.addCode(`mov [rdx+${index*8}], rax`)
                    })
                }else if(this.element!.type==='string'){
                    values.forEach((item,index)=>{
                        const label = `${this.element!.name}_${index}`
                        ASM.addData(`${label} db ${item},0`)
                        ASM.addCode(`lea rax, [${label}]`)
                        ASM.addCode(`mov rdx, [${this.element!.name}]`)
                        ASM.addCode(`mov [rdx+${index*8}], rax`)
                    })
                }else{
                    values.forEach((item,index)=>{
                        const literal = this.element!.numericKind==='float'&&getNumericKind(item)==='integer'
                            ? `${Number(item)}.0`
                            : item
                        if(this.element!.numericKind==='float'){
                            ASM.addCode(`movsd xmm0, qword [__ds_array_literal_${this.element!.name}_${index}]`)
                            ASM.addCode(`mov rdx, [${this.element!.name}]`)
                            ASM.addCode(`movsd qword [rdx+${index*8}], xmm0`)
                            ASM.addData(`__ds_array_literal_${this.element!.name}_${index} dq ${literal}`)
                        }else{
                            ASM.addCode(`mov rax, ${literal}`)
                            ASM.addCode(`mov rdx, [${this.element!.name}]`)
                            ASM.addCode(`mov [rdx+${index*8}], rax`)
                        }
                    })
                }
                ASM.addCode(`jmp ${allocationReady}`)
                ASM.addCode(`${allocationError}:`)
                ASM.addCode('mov ecx, 1')
                ASM.addCode('sub rsp, 40')
                ASM.addImport('kernel32','ExitProcess')
                ASM.addCode('call [ExitProcess]')
                ASM.addCode('add rsp, 40')
                ASM.addCode(`${allocationReady}:`)
                return
            }
            if(this.element!.classType){
                const instances = splitTopLevelArrayValues(value??'')
                const labels = instances.map((item,index)=>{
                    const label = `${this.element!.name}_${index}`
                    ASM.addData(`${label} ${this.element!.classType}`)
                    return label
                })
                ASM.addData(`${this.element!.name} dq ${Array(instances.length).fill(0).join(', ')}`)
                labels.forEach((label,index)=>{
                    ASM.addCode(`lea rax, [${label}]`)
                    ASM.addCode(`mov [${this.element!.name}+${index*8}], rax`)
                })
                return
            }
            if(this.element!.type==='string'||this.element!.type==='string[]'){
                const literals = splitTopLevelArrayValues(value??'')
                const labels = literals.map((item,index)=>{
                    const label = `${this.element!.name}_${index}`
                    ASM.addData(`${label} db ${item},0`)
                    return label
                })
                ASM.addData(`${this.element!.name} dq ${Array(literals.length).fill(0).join(', ')}`)
                labels.forEach((label,index)=>{
                    ASM.addCode(`lea rax, [${label}]`)
                    ASM.addCode(`mov [${this.element!.name}+${index*8}], rax`)
                })
                return
            }
            if(this.element!.numericKind==='float'){
                value = value!.split(',').map(item=>{
                    const literal = item.trim()
                    return getNumericKind(literal)==='integer'?`${Number(literal)}.0`:literal
                }).join(', ')
            }
            ASM.addData(`${this.element!.name} dq ${value}`)
            return
        }
        if(this.element!.classType){
            ASM.addData(`${this.element!.name} ${this.element!.classType}`)
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