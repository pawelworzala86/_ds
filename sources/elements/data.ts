import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import DataElement, {getNumericKind} from './dataElement.ts'
import Assign from './assign.ts'
import ClassElement from './clasElement.ts'

let structLayoutId = 0
let objectStringLabelId = 0

type ObjectLiteralProperty = {name:string,type:'number'|'string',value:string}

function initializeStructStrings(ASM:Asm,instanceName:string,properties:DataElement[],getClass:(name:string)=>ClassElement|null,prefix=''){
    for(const property of properties){
        if(property.classType&&!property.isArray){
            const nestedClass = getClass(property.classType)
            if(nestedClass){
                initializeStructStrings(ASM,instanceName,nestedClass.props,getClass,`${prefix}${property.name}_`)
            }
            continue
        }
        if(property.type!=='string'){
            continue
        }
        const label = `__ds_object_string_${++objectStringLabelId}`
        ASM.addData(`${label} db '${property.value??''}',0`)
        ASM.addCode(`lea rax, [${label}]`)
        ASM.addCode(`mov [${instanceName}.${prefix}${property.name}], rax`)
    }
}

function getStructFields(properties:DataElement[],getClass:(name:string)=>ClassElement|null):DataElement[]{
    return properties.flatMap(property=>{
        if(property.classType&&!property.isArray){
            const nestedClass = getClass(property.classType)
            if(nestedClass){
                return getStructFields(nestedClass.props,getClass)
            }
        }
        if(property.isArray){
            const values = splitTopLevelArrayValues(property.value??'')
            return (values.length?values:['0']).map(value=>{
                const field = new DataElement(property.kind??'let',property.name??'',property.type??'',value)
                field.numericKind = property.numericKind
                return field
            })
        }
        return [property]
    })
}

function initializeStackStructStrings(ASM:Asm,instanceName:string,properties:DataElement[]){
    properties.forEach((property,index)=>{
        if(property.type!=='string'){
            return
        }
        const label = `__ds_object_string_${++objectStringLabelId}`
        ASM.addData(`${label} db '${property.value??''}',0`)
        ASM.addCode(`lea rax, [${label}]`)
        ASM.addCode(`lea rdx, [${instanceName}]`)
        ASM.addCode(`mov [rdx+${index*8}], rax`)
    })
}

function parseObjectLiteral(tokens:string[]):ObjectLiteralProperty[]{
    if(tokens[0]!=='{'||tokens[tokens.length-1]!=='}'){
        throw new Error('Invalid struct initializer')
    }
    const properties:ObjectLiteralProperty[] = []
    let index = 1
    while(index<tokens.length-1){
        if(tokens[index]===','){
            index++
            continue
        }
        const name = tokens[index++]
        if(!/^[a-z_$][\w$]*$/i.test(name??'')||tokens[index++]!==':'){
            throw new Error('Invalid property in struct initializer')
        }
        const valueTokens:string[] = []
        let quote:string|null = null
        while(index<tokens.length-1){
            const token = tokens[index]
            if(quote){
                valueTokens.push(token)
                if(token===quote){
                    quote = null
                }
                index++
                continue
            }
            if(token==="'"||token==='"'){
                quote = token
                valueTokens.push(token)
                index++
                continue
            }
            if(token===','){
                break
            }
            valueTokens.push(token)
            index++
        }
        if(quote||!valueTokens.length){
            throw new Error(`Invalid initializer for struct property "${name}"`)
        }
        const value = valueTokens.join('')
        const stringLiteral = value.match(/^(['"])([\s\S]*)\1$/)
        if(stringLiteral){
            properties.push({name,type:'string',value:stringLiteral[2]})
        }else if(/^[+-]?(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(value)){
            properties.push({name,type:'number',value})
        }else{
            throw new Error(`Struct property "${name}" must be initialized with a string or number literal`)
        }
        if(tokens[index]===','){
            index++
        }else if(index<tokens.length-1){
            throw new Error(`Expected ',' after struct property "${name}"`)
        }
    }
    return properties
}

function createStructLayout(properties:ObjectLiteralProperty[],classType:ReturnType<Base['getClass']>|null,name:string):{type:string,props:DataElement[]}{
    const layoutProps = properties.map(property=>{
        const declaredProperty = classType?.props.find(prop=>prop.name===property.name)
        if(classType&&!declaredProperty){
            throw new Error(`Unknown property "${property.name}" in struct "${classType.name}"`)
        }
        if(declaredProperty&&declaredProperty.type!==property.type){
            throw new Error(`Property "${property.name}" in struct "${classType!.name}" must be a ${declaredProperty.type}`)
        }
        if(declaredProperty&&(declaredProperty.isArray||declaredProperty.classType)){
            throw new Error(`Struct initializer does not support array or nested property "${property.name}"`)
        }
        const element = new DataElement('let',property.name,property.type,property.value)
        return element
    })
    if(classType){
        for(const property of classType.props){
            if(!properties.some(value=>value.name===property.name)){
                throw new Error(`Missing property "${property.name}" in struct initializer for "${classType.name}"`)
            }
        }
    }else if(!layoutProps.length){
        throw new Error(`Cannot infer struct type for empty initializer "${name}"`)
    }
    if(new Set(layoutProps.map(property=>property.name)).size!==layoutProps.length){
        throw new Error('Duplicate property in struct initializer')
    }
    return {type:`__ds_struct_${++structLayoutId}`,props:layoutProps}
}

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
        let objectDepth = 0
        while(tokenizer.has()){
            const token = tokenizer.get()
            if(token==='\n'){
                if(objectDepth===0){
                    break
                }
                continue
            }
            if(token===';'&&objectDepth===0){
                break
            }
            tokens.push(token)
            if(token==='{'){
                objectDepth++
            }else if(token==='}'){
                objectDepth--
            }
        }
        if(!classField&&tokens[1]==='{'){
            this.setDestructure(tokens)
            return
        }
        let kind:string
        let name:string
        let type:string|undefined
        if(classField){
            kind = 'let'
            name = tokens[0]
            type = tokens[2]
        }else{
            kind = tokens[0]
            name = tokens[1]
            type = tokens[2]===':'?tokens[3]:undefined
        }
        type = type?.replace(/;$/,'')
        const initializerIndex = tokens.indexOf('=')
        const hasInitializer = initializerIndex!==-1
        const initializerTokens = hasInitializer?tokens.slice(initializerIndex+1):[]
        const eq = hasInitializer?'=':undefined
        let value = initializerTokens[0]
        const asyncFunctionName = /^[a-z_$][\w$]*$/i.test(initializerTokens[0]??'')
            &&initializerTokens[1]==='('
            &&initializerTokens[initializerTokens.length-1]===')'
            ? initializerTokens[0]
            : null
        const isTimeoutInitializer = initializerTokens[0]==='setTimeout'
            &&initializerTokens[1]==='('
            &&initializerTokens[initializerTokens.length-1]===')'
        const isAsyncInitializer = Boolean(
            isTimeoutInitializer
            ||asyncFunctionName&&this.parent?.getFunction(asyncFunctionName)?.isAsync
        )
        if(type==='Task'&&hasInitializer&&!isAsyncInitializer){
            throw new Error(`Task "${name}" must be initialized with an async function call or setTimeout`)
        }
        if(!type&&isAsyncInitializer){
            type='Task'
        }
        if(type==='Task'){
            value='0'
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
            numericExpression = initializerTokens.join('').replace(/;$/,'')
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
        let classType = normalizedType?this.parent?.getClass(normalizedType):null
        let classLayout:{type:string,props:DataElement[]}|null = null
        if(classType&&!arrayType&&eq==='='){
            if(initializerTokens[0]==='{'){
                const properties = parseObjectLiteral(initializerTokens)
                classLayout = createStructLayout(properties,classType,name)
            }else if(initializerTokens.length!==4||initializerTokens[0]!=='new'||initializerTokens[1]!==normalizedType||initializerTokens[2]!=='('||initializerTokens[3]!==')'){
                throw new Error(`Class instance "${name}" must be initialized with new ${normalizedType}()`)
            }
        }else if(!type&&eq==='='&&initializerTokens[0]==='{'){
            const properties = parseObjectLiteral(initializerTokens)
            classLayout = createStructLayout(properties,null,name)
            classType = new ClassElement(classLayout.type,classLayout.props,[])
            this.parent?.addClass(classType)
            type = classLayout.type
        }
        let values = [value]
        if(type=='string'){
            let open = false
            let spec = false
            values = []
            for(const token of initializerTokens){
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
        this.element = new DataElement(kind,name,arrayType?arrayType[1]:type??'',arrayType?value:values.join(' ')??'')
        if(classLayout){
            this.element.classLayoutType = classLayout.type
            this.element.classLayoutProps = classLayout.props
        }
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
        if(isAsyncInitializer&&this.parent){
            const initializer = new Assign(this.parent)
            initializer.setTask(this.element,initializerTokens.join(''))
            this.parent.children.push(initializer)
        }
    }
    setDestructure(tokens:string[]){
        const close = tokens.indexOf('}')
        const equals = tokens.indexOf('=')
        const sourceName = tokens[equals+1]
        if(close<2||equals!==close+1||!sourceName||equals!==tokens.length-2){
            throw new Error('Invalid struct destructuring declaration')
        }
        const source = this.parent?.getData(sourceName)
        const classType = source?.classType?this.parent?.getClass(source.classType):null
        if(!source||!classType||source.isArray){
            throw new Error(`Cannot destructure non-struct value "${sourceName}"`)
        }
        const names = tokens.slice(2,close).filter(token=>token!==',')
        if(!names.length||names.some(name=>!/^[a-z_$][\w$]*$/i.test(name))){
            throw new Error('Invalid property in struct destructuring declaration')
        }
        if(new Set(names).size!==names.length){
            throw new Error('Duplicate property in struct destructuring declaration')
        }
        for(const name of names){
            const property = classType.props.find(item=>item.name===name)
            if(!property){
                throw new Error(`Unknown property "${name}" in struct "${classType.name}"`)
            }
            if(property.isArray||property.classType||!['number','string'].includes(property.type??'')){
                throw new Error(`Struct destructuring does not support array or nested property "${name}"`)
            }
            const layoutProperty = source.classLayoutProps?.find(item=>item.name===name)
            const value = layoutProperty?.value??property.value??''
            const element = new DataElement(tokens[0],name,property.type??'',property.type==='number'?'0':value)
            this.parent?.addData(element)
            const declaration = new Data(this.parent!)
            declaration.element = element
            this.parent?.children.push(declaration)
            if(property.type==='number'){
                const initializer = new Assign(this.parent!)
                initializer.setExpression(element,`${sourceName}.${name}`,true)
                this.parent?.children.push(initializer)
            }
        }
    }
    asm(ASM:Asm){
        if(!this.element){
            return
        }
        if(this.element!.isProcedureLocal&&this.element!.isArray&&this.element!.type==='number'&&!this.element!.dynamicArray){
            const values = splitTopLevelArrayValues(this.element!.value??'')
            if(this.element!.numericKind==='float'){
                ASM.addCode(`local ${this.element!.name} dq ${values.map(()=>0).join(', ')}`)
                values.forEach((value,index)=>{
                    const literal = getNumericKind(value)==='integer'?`${Number(value)}.0`:value
                    const label = `__ds_local_array_literal_${this.element!.name}_${index}`
                    ASM.addData(`${label} dq ${literal}`)
                    ASM.addCode(`movsd xmm0, qword [${label}]`)
                    ASM.addCode(`movsd qword [${this.element!.name}+${index*8}], xmm0`)
                })
            }else{
                ASM.addCode(`local ${this.element!.name} dq ${values.join(', ')}`)
            }
            return
        }
        if(this.element!.isProcedureLocal&&this.element!.classType&&!this.element!.isArray){
            const classType = this.parent?.getClass(this.element!.classType)
            const properties = this.element!.classLayoutProps??classType?.props
            if(!properties){
                throw new Error(`Unknown class type "${this.element!.classType}" for local "${this.element!.name}"`)
            }
            const fields = this.element!.classLayoutProps
                ? properties
                : getStructFields(properties,name=>this.parent!.getClass(name))
            ASM.addCode(`local ${this.element!.name} dq ${fields.map(()=>0).join(', ')||'0'}`)
            fields.forEach((property,index)=>{
                const value = property.type==='string'?null:property.value
                if(!value||value==='0'){
                    return
                }
                if(property.type==='number'&&getNumericKind(value)==='float'){
                    const label = `__ds_local_struct_literal_${this.element!.name}_${index}`
                    ASM.addData(`${label} dq ${value}`)
                    ASM.addCode(`movsd xmm0, qword [${label}]`)
                    ASM.addCode(`lea rdx, [${this.element!.name}]`)
                    ASM.addCode(`movsd qword [rdx+${index*8}], xmm0`)
                }else{
                    ASM.addCode(`mov rax, ${value}`)
                    ASM.addCode(`lea rdx, [${this.element!.name}]`)
                    ASM.addCode(`mov [rdx+${index*8}], rax`)
                }
            })
            initializeStackStructStrings(ASM,this.element!.name!,fields)
            return
        }
        if(this.element!.isProcedureLocal){
            ASM.addCode(`local ${this.element!.name} dq ${this.element!.value}`)
            return
        }
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
                        const classType = this.parent?.getClass(this.element!.classType!)
                        if(classType){
                            initializeStructStrings(ASM,label,classType.props,name=>this.parent!.getClass(name))
                        }
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
                    const classType = this.parent?.getClass(this.element!.classType!)
                    if(classType){
                        initializeStructStrings(ASM,label,classType.props,name=>this.parent!.getClass(name))
                    }
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
            if(this.element!.classLayoutType&&this.element!.classLayoutProps){
                const members = this.element!.classLayoutProps.map(prop=>{
                    if(prop.type==='string'){
                        return `    ${prop.name} dq 0`
                    }
                    return `    ${prop.name} dq ${prop.value}`
                })
                ASM.addCode([`struct ${this.element!.classLayoutType}`,...members,'end struct'].join('\n'))
                ASM.addData(`${this.element!.name} ${this.element!.classLayoutType}`)
                initializeStructStrings(
                    ASM,
                    this.element!.name!,
                    this.element!.classLayoutProps,
                    name=>this.parent!.getClass(name)
                )
            }else{
                ASM.addData(`${this.element!.name} ${this.element!.classType}`)
                const classType = this.parent?.getClass(this.element!.classType)
                if(classType){
                    initializeStructStrings(ASM,this.element!.name!,classType.props,name=>this.parent!.getClass(name))
                }
            }
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