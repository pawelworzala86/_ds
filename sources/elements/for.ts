import Tokenizer from '../tokenizer.ts'
import Asm from '../asm.ts'
import Base from './base.ts'
import Assign from './assign.ts'
import Data from './data.ts'
import DataElement from './dataElement.ts'
import While from './while.ts'
import {getClassPropertyAccess, getClassPropertyOffset} from './clasElement.ts'

let forInId = 0
let forOfId = 0

function countArrayValues(value:string){
    if(!value.trim()){
        return 0
    }
    let count = 1
    let depth = 0
    let quote:string|null = null
    for(let index=0;index<value.length;index++){
        const char = value[index]
        if(quote){
            if(char==='\\'){
                index++
            }else if(char===quote){
                quote = null
            }
        }else if(char==="'"||char==='"'){
            quote = char
        }else if(char==='('||char==='['||char==='{'){
            depth++
        }else if(char===')'||char===']'||char==='}'){
            depth--
        }else if(char===','&&depth===0){
            count++
        }
    }
    return count
}

export class For extends While{
    initStatements:Base[] = []
    updateStatements:Base[] = []
    iterationArray:DataElement|null = null
    dynamicLength:DataElement|null = null
    iterationValue:DataElement|null = null
    iterationIndex:DataElement|null = null

    set(tokenizer:Tokenizer){
        if(tokenizer.get()!=='for'||tokenizer.get()!=='('){
            throw new Error('Invalid for statement')
        }

        const clauses:string[][] = [[],[],[]]
        let clause = 0
        let parentheses = 0
        let closed = false
        while(tokenizer.has()){
            const token = tokenizer.get()
            if(token==='('){
                parentheses++
                clauses[clause].push(token)
            }else if(token===')'){
                if(parentheses===0){
                    closed = true
                    break
                }
                parentheses--
                clauses[clause].push(token)
            }else if(token===';'&&parentheses===0){
                if(clause===2){
                    throw new Error('For statement must have three clauses')
                }
                clause++
            }else if(token!=='\n'){
                clauses[clause].push(token)
            }
        }
        if(!closed){
            throw new Error('For statement must have three clauses')
        }
        if(clause===0&&(clauses[0].includes('in')||clauses[0].includes('of'))){
            if(clauses[0].includes('of')){
                this.setForOf(clauses[0],tokenizer)
            }else{
                this.setForIn(clauses[0],tokenizer)
            }
            return
        }
        if(clause!==2){
            throw new Error('For statement must have three clauses')
        }

        this.compileHeaderStatement(clauses[0],this.initStatements,true)
        const condition = clauses[1].join('')
        this.condition = this.parseCondition(condition||'true')
        this.compileHeaderStatement(clauses[2],this.updateStatements,false)

        let next = tokenizer.get()
        while(next==='\n'){
            next = tokenizer.get()
        }
        if(next!=='{'){
            throw new Error('Expected "{" after for header')
        }
        tokenizer.move(-1)
        this.thenBranch = this.compileBranch(tokenizer.getBlock())
    }

    setForIn(tokens:string[],tokenizer:Tokenizer){
        if(tokens.length!==4||!['const','let','var'].includes(tokens[0])||tokens[2]!=='in'||!/^[a-z_$][\w.$]*$/i.test(tokens[1])){
            throw new Error('Invalid for-in statement')
        }
        const array = this.getData(tokens[3])
        if(!array?.isArray){
            throw new Error(`For-in loop expects an array identifier, received "${tokens[3]}"`)
        }

        const variable = new DataElement('let',tokens[1],'number','0')
        this.addData(variable)
        const declaration = new Data(this)
        declaration.element = variable
        this.children.push(declaration)
        this.initStatements.push(declaration)

        const initializer = new Assign(this)
        initializer.setExpression(variable,'0',true)
        this.children.push(initializer)
        this.initStatements.push(initializer)

        const update = new Assign(this)
        update.setExpression(variable,`${tokens[1]}+1`)
        this.children.push(update)
        this.updateStatements.push(update)

        let length:string
        if(array.dynamicArray){
            this.dynamicLength = new DataElement('let',`__ds_for_in_length_${++forInId}`,'number','0')
            this.addData(this.dynamicLength)
            length = this.dynamicLength.name!
        }else{
            length = `${countArrayValues(array.value??'')}`
        }
        this.iterationArray = array
        this.condition = this.parseCondition(`${tokens[1]}<${length}`)

        let next = tokenizer.get()
        while(next==='\n'){
            next = tokenizer.get()
        }
        if(next!=='{'){
            throw new Error('Expected "{" after for-in header')
        }
        tokenizer.move(-1)
        this.thenBranch = this.compileBranch(tokenizer.getBlock())
    }

    setForOf(tokens:string[],tokenizer:Tokenizer){
        if(tokens.length!==4||!['const','let','var'].includes(tokens[0])||tokens[2]!=='of'||!/^[a-z_$][\w$]*$/i.test(tokens[1])){
            throw new Error('Invalid for-of statement')
        }
        const access = getClassPropertyAccess(this,tokens[3])
        const array = this.getData(tokens[3])??(access
            ? new DataElement('let',`${access.instance.name}.${access.path}`,access.property.type??'',access.property.value??'')
            : null)
        if(access&&array){
            array.isArray = access.property.isArray
            array.dynamicArray = access.property.dynamicArray
            array.classPropertyDynamicArray = access.property.dynamicArray
            array.classType = access.property.classType
            array.classPropertyInstance = access.instance
            array.classPropertyPath = access.path
            const classType = access.instance.classType
                ? this.getClass(access.instance.classType)
                : null
            array.classPropertyOffset = classType
                ? getClassPropertyOffset(classType,tokens[3].split('.').slice(1).join('.'),name=>this.getClass(name))
                : null
        }
        if(!array?.isArray||(!array.classType&&array.type!=='string')){
            throw new Error(`For-of loop expects an object or string array identifier, received "${tokens[3]}"`)
        }

        let inFunction = false
        for(let scope:Base|null=this;scope;scope=scope.parent){
            if(scope.isFunctionScope){
                inFunction = true
                break
            }
        }

        const index = new DataElement('let',`__ds_for_of_index_${++forOfId}`,'number','0')
        index.isProcedureLocal = inFunction
        this.addData(index)
        const indexDeclaration = new Data(this)
        indexDeclaration.element = index
        this.children.push(indexDeclaration)
        this.initStatements.push(indexDeclaration)

        const indexInitializer = new Assign(this)
        indexInitializer.setExpression(index,'0',true)
        this.children.push(indexInitializer)
        this.initStatements.push(indexInitializer)

        const value = new DataElement(tokens[0],tokens[1],array.classType??array.type??'','0')
        value.classType = array.classType
        value.isProcedureLocal = inFunction
        value.isHeapAllocated = true
        value.isReferenceAlias = true
        this.addData(value)
        const valueDeclaration = new Data(this)
        valueDeclaration.element = value
        this.children.push(valueDeclaration)
        this.initStatements.push(valueDeclaration)

        const update = new Assign(this)
        update.setExpression(index,`${index.name}+1`)
        this.children.push(update)
        this.updateStatements.push(update)

        let length:string
        if(array.dynamicArray){
            this.dynamicLength = new DataElement('let',`__ds_for_of_length_${forOfId}`,'number','0')
            this.addData(this.dynamicLength)
            if(array.classPropertyInstance&&array.classPropertyOffset!==null){
                this.dynamicLength.isProcedureLocal = inFunction
                const declaration = new Data(this)
                declaration.element = this.dynamicLength
                this.children.push(declaration)
                this.initStatements.push(declaration)
            }
            length = this.dynamicLength.name!
        }else{
            length = `${countArrayValues(array.value??'')}`
        }
        this.iterationArray = array
        this.iterationIndex = index
        this.iterationValue = value
        this.condition = this.parseCondition(`${index.name}<${length}`)

        let next = tokenizer.get()
        while(next==='\n'){
            next = tokenizer.get()
        }
        if(next!=='{'){
            throw new Error('Expected "{" after for-of header')
        }
        tokenizer.move(-1)
        this.thenBranch = this.compileBranch(tokenizer.getBlock())
    }

    compileHeaderStatement(tokens:string[],statements:Base[],allowDeclaration:boolean){
        if(!tokens.length){
            return
        }
        let source = tokens.join(' ')
        if(allowDeclaration){
            source = source.replace(
                /^((?:let|var|const)\s+[a-z_$][\w$]*)(?=\s*=\s*[+-]?(?:\d|\.\d))/i,
                '$1: number'
            )
            source = source.replace(
                /^((?:let|var|const)\s+[a-z_$][\w$]*(?:\s*:\s*[\w$[\]]+)?)\s*=\s*/i,
                '$1 = '
            )
        }
        const tokenizer = new Tokenizer(`${source}\n`)
        const childCount = this.children.length
        const statement = (allowDeclaration?Data.test(this,tokenizer):null)
            ??Assign.test(this,tokenizer)
        if(!statement||tokenizer.has()){
            throw new Error(`Invalid ${allowDeclaration?'for initializer':'for update'} clause`)
        }
        const headerStatements = this.children.slice(childCount)
        statements.push(...headerStatements)
        const element = statement instanceof Data?statement.element:null
        if(element
            &&['let','var'].includes(element.kind??'')
            &&element.type==='number'
            &&tokens.join('').includes('=')
            &&!headerStatements.some(child=>child instanceof Assign&&child.target===element)
        ){
            const initializer = new Assign(this)
            initializer.setExpression(element,element.value??'0',true)
            this.children.push(initializer)
            statements.push(initializer)
        }
    }

    testChangeName(){
        super.testChangeName()
        if(this.dynamicLength&&this.iterationArray&&!this.iterationArray.classPropertyInstance){
            this.dynamicLength.name = `${this.iterationArray.name}__length`
        }
    }

    asm(ASM:Asm){
        if(!this.condition||!this.thenBranch){
            throw new Error('For statement is not initialized')
        }
        this.initStatements.forEach(statement=>statement.asm(ASM))
        ASM.addCode(`${this.startLabel}:`)
        if(this.iterationArray?.classPropertyInstance
            &&this.iterationArray.classPropertyOffset!==null
            &&this.dynamicLength){
            const instance = this.iterationArray.classPropertyInstance
            ASM.addCode(instance.isHeapAllocated
                ? `mov rdx, [${instance.name}]`
                : `lea rdx, [${instance.name}]`)
            if(this.iterationArray.classPropertyOffset){
                ASM.addCode(`add rdx, ${this.iterationArray.classPropertyOffset}`)
            }
            ASM.addCode('mov rax, [rdx+8]')
            ASM.addCode(`mov [${this.dynamicLength.name}], rax`)
        }
        this.emitBranch(this.condition,ASM,this.bodyLabel,this.endLabel)
        ASM.addCode(`${this.bodyLabel}:`)
        if(this.iterationArray&&this.iterationIndex&&this.iterationValue){
            const array = this.iterationArray
            ASM.addCode(`mov rax, [${this.iterationIndex.name}]`)
            ASM.addCode('shl rax, 3')
            if(array.classPropertyInstance&&array.classPropertyOffset!==null){
                const instance = array.classPropertyInstance
                ASM.addCode(instance.isHeapAllocated
                    ? `mov rdx, [${instance.name}]`
                    : `lea rdx, [${instance.name}]`)
                if(array.classPropertyOffset){
                    ASM.addCode(`add rdx, ${array.classPropertyOffset}`)
                }
                if(array.dynamicArray){
                    ASM.addCode('mov rdx, [rdx]')
                }
            }else if(array.isParameter){
                ASM.addCode(`mov rdx, ${array.name}`)
                if(array.dynamicArray){
                    ASM.addCode('mov rdx, [rdx]')
                }
            }else{
                ASM.addCode(array.dynamicArray
                    ? `mov rdx, [${array.name}]`
                    : `lea rdx, [${array.name}]`)
            }
            ASM.addCode('add rdx, rax')
            ASM.addCode('mov rax, [rdx]')
            ASM.addCode(`mov [${this.iterationValue.name}], rax`)
        }
        this.thenBranch.asm(ASM)
        this.updateStatements.forEach(statement=>statement.asm(ASM))
        ASM.addCode(`jmp ${this.startLabel}`)
        ASM.addCode(`${this.endLabel}:`)
    }

    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(token==='for'){
            tokenizer.move(-1)
            const statement = new For(active)
            statement.set(tokenizer)
            active.children.push(statement)
            return statement
        }
        tokenizer.move(-1)
        return null
    }
}

export default For
