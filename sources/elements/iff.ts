import Tokenizer from '../tokenizer.ts'
import Asm from '../asm.ts'
import Make from '../make.ts'
import Base from './base.ts'
import Call from './call.ts'
import DataElement from './dataElement.ts'
import {emitExpression,parseExpression,type Expression} from '../maths.ts'

type StringOperand =
    | {kind:'literal',value:string}
    | {kind:'data',value:DataElement}

type Condition =
    | {kind:'and',left:Condition,right:Condition}
    | {kind:'or',left:Condition,right:Condition}
    | {kind:'not',value:Condition}
    | {kind:'boolean',value:boolean}
    | {kind:'compare',left:Expression|StringOperand,right:Expression|StringOperand,operator:string,calls:ConditionCall[]}
    | {kind:'truthy',value:Expression,calls:ConditionCall[]}

type ConditionCall = {call:Call,temp:DataElement}
type ParsedOperand = {value:Expression|StringOperand,calls:ConditionCall[]}

let ifId = 0

function nextLabel(prefix:string){
    return `__ds_if_${prefix}_${++ifId}`
}

function isWrapped(text:string){
    if(text[0]!=='('||text[text.length-1]!==')'){
        return false
    }
    let depth = 0
    let quote:string|null = null
    for(let index=0;index<text.length;index++){
        const char = text[index]
        if(quote){
            if(char==='\\'){
                index++
            }else if(char===quote){
                quote = null
            }
            continue
        }
        if(char==="'"||char==='"'){
            quote = char
        }else if(char==='('){
            depth++
        }else if(char===')'){
            depth--
            if(depth===0&&index!==text.length-1){
                return false
            }
        }
    }
    return depth===0
}

function findTopLevel(text:string,operator:string,fromRight=false){
    const matches:number[] = []
    let parentheses = 0
    let brackets = 0
    let quote:string|null = null
    for(let index=0;index<=text.length-operator.length;index++){
        const char = text[index]
        if(quote){
            if(char==='\\'){
                index++
            }else if(char===quote){
                quote = null
            }
            continue
        }
        if(char==="'"||char==='"'){
            quote = char
        }else if(char==='('){
            parentheses++
        }else if(char===')'){
            parentheses--
        }else if(char==='['){
            brackets++
        }else if(char===']'){
            brackets--
        }else if(parentheses===0&&brackets===0&&text.startsWith(operator,index)){
            matches.push(index)
            index += operator.length-1
        }
    }
    return matches.length?matches[fromRight?matches.length-1:0]:-1
}

function findComparison(text:string){
    let parentheses = 0
    let brackets = 0
    let quote:string|null = null
    const operators = ['===','!==','==','!=','<=','>=','<','>']
    for(let index=0;index<text.length;index++){
        const char = text[index]
        if(quote){
            if(char==='\\'){
                index++
            }else if(char===quote){
                quote = null
            }
            continue
        }
        if(char==="'"||char==='"'){
            quote = char
        }else if(char==='('){
            parentheses++
        }else if(char===')'){
            parentheses--
        }else if(char==='['){
            brackets++
        }else if(char===']'){
            brackets--
        }else if(parentheses===0&&brackets===0){
            const operator = operators.find(value=>text.startsWith(value,index))
            if(operator){
                return {index,operator}
            }
        }
    }
    return null
}

function findClosingParenthesis(text:string,open:number){
    let depth = 0
    let quote:string|null = null
    for(let index=open;index<text.length;index++){
        const char = text[index]
        if(quote){
            if(char==='\\'){
                index++
            }else if(char===quote){
                quote = null
            }
        }else if(char==="'"||char==='"'){
            quote = char
        }else if(char==='('){
            depth++
        }else if(char===')'){
            depth--
            if(depth===0){
                return index
            }
        }
    }
    throw new Error('Unclosed function call in if condition')
}

export class Iff extends Base{
    condition:Condition|null = null
    thenBranch:Base|null = null
    elseBranch:Base|null = null

    constructor(parent:Base){
        super(parent)
    }

    static isConditionExpression(source:string){
        let text = source.trim()
        while(isWrapped(text)){
            text = text.slice(1,-1).trim()
        }
        return text==='true'||text==='false'
            ||(text.startsWith('!')&&!text.startsWith('!='))
            ||findTopLevel(text,'||')!==-1
            ||findTopLevel(text,'&&')!==-1
            ||findComparison(text)!==null
    }

    set(tokenizer:Tokenizer){
        if(tokenizer.get()!=='if'||tokenizer.get()!=='('){
            throw new Error('Invalid if statement')
        }
        const conditionTokens = tokenizer.getCallArguments()
        if(conditionTokens.length!==1){
            throw new Error('If condition must be a single expression')
        }
        this.condition = this.parseCondition(conditionTokens[0])

        let next = tokenizer.get()
        while(next==='\n'){
            next = tokenizer.get()
        }
        if(next!=='{'){
            throw new Error('Expected "{" after if condition')
        }
        tokenizer.move(-1)
        const thenTokens = tokenizer.getBlock()
        this.thenBranch = this.compileBranch(thenTokens)

        const afterBlock = tokenizer.index
        next = tokenizer.get()
        while(next==='\n'){
            next = tokenizer.get()
        }
        if(next!=='else'){
            tokenizer.index = afterBlock
            return
        }
        next = tokenizer.get()
        while(next==='\n'){
            next = tokenizer.get()
        }
        if(next==='if'){
            tokenizer.move(-1)
            const nested = new Iff(this)
            nested.set(tokenizer)
            this.elseBranch = nested
            return
        }
        tokenizer.move(-1)
        if(next!=='{'){
            throw new Error('Expected "{" or "if" after else')
        }
        this.elseBranch = this.compileBranch(tokenizer.getBlock())
    }

    compileBranch(tokens:string[]){
        const branch = new Base(this)
        const branchTokenizer = new Tokenizer('')
        branchTokenizer.tokens = tokens.slice(1,-1)
        Make.compile(new Asm(),branch,branchTokenizer)
        return branch
    }

    parseCondition(source:string):Condition{
        let text = source.trim()
        while(isWrapped(text)){
            text = text.slice(1,-1).trim()
        }
        let index = findTopLevel(text,'||')
        if(index!==-1){
            return {
                kind:'or',
                left:this.parseCondition(text.slice(0,index)),
                right:this.parseCondition(text.slice(index+2))
            }
        }
        index = findTopLevel(text,'&&')
        if(index!==-1){
            return {
                kind:'and',
                left:this.parseCondition(text.slice(0,index)),
                right:this.parseCondition(text.slice(index+2))
            }
        }
        if(text.startsWith('!')&&!text.startsWith('!=')){
            return {kind:'not',value:this.parseCondition(text.slice(1))}
        }
        if(text==='true'||text==='false'){
            return {kind:'boolean',value:text==='true'}
        }
        const comparison = findComparison(text)
        if(comparison){
            const left = this.parseOperand(text.slice(0,comparison.index))
            const right = this.parseOperand(text.slice(comparison.index+comparison.operator.length))
            const leftString = this.isStringOperand(left.value)
            const rightString = this.isStringOperand(right.value)
            if(leftString!==rightString){
                throw new Error('Cannot compare a string with a number in if condition')
            }
            if(leftString&& !['==','===','!=','!=='].includes(comparison.operator)){
                throw new Error(`Operator "${comparison.operator}" is not supported for strings`)
            }
            return {
                kind:'compare',
                left:left.value,
                right:right.value,
                operator:comparison.operator,
                calls:[...left.calls,...right.calls]
            }
        }
        const operand = this.parseOperand(text)
        if(this.isStringOperand(operand.value)){
            throw new Error('A string cannot be used as an if condition')
        }
        return {kind:'truthy',value:operand.value,calls:operand.calls}
    }

    parseOperand(source:string):ParsedOperand{
        const text = source.trim()
        if(!text){
            throw new Error('Expected a value in if condition')
        }
        if((text.startsWith("'")&&text.endsWith("'"))||(text.startsWith('"')&&text.endsWith('"'))){
            return {value:{kind:'literal',value:text},calls:[]}
        }
        const data = this.getData(text)
        if(data?.type==='string'&&!data.isArray){
            return {value:{kind:'data',value:data},calls:[]}
        }
        const calls:ConditionCall[] = []
        const expression = this.replaceCalls(text,calls)
        return {value:parseExpression(expression,this),calls}
    }

    replaceCalls(text:string,calls:ConditionCall[]):string{
        let result = ''
        let index = 0
        while(index<text.length){
            const char = text[index]
            if(char==="'"||char==='"'){
                const quote = char
                const start = index++
                while(index<text.length){
                    if(text[index]==='\\'){
                        index += 2
                    }else if(text[index++]===quote){
                        break
                    }
                }
                result += text.slice(start,index)
                continue
            }
            if(/[a-z_$]/i.test(char)){
                const start = index
                index++
                while(index<text.length&&/[a-z0-9_$.]/i.test(text[index])){
                    index++
                }
                const name = text.slice(start,index)
                let open = index
                while(open<text.length&&/\s/.test(text[open])){
                    open++
                }
                if(text[open]!=='('){
                    result += name+text.slice(index,open)
                    index = open
                    continue
                }
                const close = findClosingParenthesis(text,open)
                const args = this.replaceCalls(text.slice(open+1,close),calls)
                const callTokenizer = new Tokenizer(`${name}(${args})`)
                const call = new Call(this)
                call.set(callTokenizer)
                if(!call.func&&!call.functionVariable){
                    throw new Error(`Unknown function "${name}" in if condition`)
                }
                const tempName = nextLabel('value')
                const temp = new DataElement('let',tempName,'number','0')
                this.addData(temp)
                calls.push({call,temp})
                result += tempName
                index = close+1
                continue
            }
            result += char
            index++
        }
        return result
    }

    isStringOperand(value:Expression|StringOperand):value is StringOperand{
        if('kind' in value&&value.kind==='literal'){
            return true
        }
        if('kind' in value&&value.kind==='data'){
            return value.value.type==='string'
        }
        return false
    }

    isFloatOperand(value:Expression|StringOperand){
        return !this.isStringOperand(value)&&value.numericKind==='float'
    }

    emitCalls(calls:ConditionCall[],ASM:Asm){
        for(const {call,temp} of calls){
            ASM.addData(`${temp.name} dq 0`)
            call.asm(ASM)
            ASM.addCode(`mov [${temp.name}], rax`)
        }
    }

    emitOperand(value:Expression|StringOperand,ASM:Asm){
        if(!this.isStringOperand(value)){
            emitExpression(value,ASM)
            return
        }
        if(value.kind==='literal'){
            const label = nextLabel('string')
            ASM.addData(`${label} db ${value.value},0`)
            ASM.addCode(`lea rax, [${label}]`)
        }else{
            ASM.addCode(`lea rax, [${value.value.getAccessName()}]`)
        }
    }

    emitBranch(condition:Condition,ASM:Asm,trueLabel:string,falseLabel:string){
        if(condition.kind==='not'){
            this.emitBranch(condition.value,ASM,falseLabel,trueLabel)
            return
        }
        if(condition.kind==='and'){
            const next = nextLabel('and')
            this.emitBranch(condition.left,ASM,next,falseLabel)
            ASM.addCode(`${next}:`)
            this.emitBranch(condition.right,ASM,trueLabel,falseLabel)
            return
        }
        if(condition.kind==='or'){
            const next = nextLabel('or')
            this.emitBranch(condition.left,ASM,trueLabel,next)
            ASM.addCode(`${next}:`)
            this.emitBranch(condition.right,ASM,trueLabel,falseLabel)
            return
        }
        if(condition.kind==='boolean'){
            ASM.addCode(`jmp ${condition.value?trueLabel:falseLabel}`)
            return
        }
        if(condition.kind==='truthy'){
            this.emitCalls(condition.calls,ASM)
            emitExpression(condition.value,ASM)
            if(condition.value.numericKind==='float'){
                ASM.addCode('xorpd xmm1, xmm1')
                ASM.addCode('ucomisd xmm0, xmm1')
                ASM.addCode(`jp ${trueLabel}`)
                ASM.addCode(`jne ${trueLabel}`)
            }else{
                ASM.addCode('test rax, rax')
                ASM.addCode(`jnz ${trueLabel}`)
            }
            ASM.addCode(`jmp ${falseLabel}`)
            return
        }
        this.emitCalls(condition.calls,ASM)
        if(this.isStringOperand(condition.left)&&this.isStringOperand(condition.right)){
            this.emitOperand(condition.left,ASM)
            ASM.addCode('push rax')
            this.emitOperand(condition.right,ASM)
            ASM.addCode('mov rdx, rax')
            ASM.addCode('pop rcx')
            ASM.addCode('sub rsp, 40')
            ASM.addCode('call [strcmp]')
            ASM.addCode('add rsp, 40')
            ASM.addImport('msvcrt','strcmp')
            ASM.addCode('test eax, eax')
            ASM.addCode(['==','==='].includes(condition.operator)
                ? `je ${trueLabel}`
                : `jne ${trueLabel}`)
            ASM.addCode(`jmp ${falseLabel}`)
            return
        }
        const isFloat = this.isFloatOperand(condition.left)
        const rightIsFloat = this.isFloatOperand(condition.right)
        if(isFloat||rightIsFloat){
            this.emitOperand(condition.left,ASM)
            const leftFloat = this.isFloatOperand(condition.left)
            if(!leftFloat){
                ASM.addCode('cvtsi2sd xmm0, rax')
            }
            ASM.addCode('sub rsp, 8')
            ASM.addCode('movsd qword [rsp], xmm0')
            this.emitOperand(condition.right,ASM)
            const rightFloat = this.isFloatOperand(condition.right)
            if(!rightFloat){
                ASM.addCode('cvtsi2sd xmm0, rax')
            }
            ASM.addCode('movsd xmm1, xmm0')
            ASM.addCode('movsd xmm0, qword [rsp]')
            ASM.addCode('add rsp, 8')
            ASM.addCode('ucomisd xmm0, xmm1')
            this.emitComparisonJump(condition.operator,ASM,trueLabel,falseLabel,true)
            return
        }
        this.emitOperand(condition.left,ASM)
        ASM.addCode('push rax')
        this.emitOperand(condition.right,ASM)
        ASM.addCode('mov rcx, rax')
        ASM.addCode('pop rax')
        ASM.addCode('cmp rax, rcx')
        this.emitComparisonJump(condition.operator,ASM,trueLabel,falseLabel,false)
    }

    emitComparisonJump(operator:string,ASM:Asm,trueLabel:string,falseLabel:string,float:boolean){
        const jumps:Record<string,string> = float
            ? {'==':'je','===':'je','!=':'jne','!==':'jne','<':'jb','<=':'jbe','>':'ja'}
            : {'==':'je','===':'je','!=':'jne','!==':'jne','<':'jl','<=':'jle','>':'jg'}
        if(operator==='>='){
            if(float){
                ASM.addCode(`jp ${falseLabel}`)
                ASM.addCode(`jb ${falseLabel}`)
            }else{
                ASM.addCode(`jl ${falseLabel}`)
            }
            ASM.addCode(`jmp ${trueLabel}`)
            return
        }
        if(float&&['==','===','<','<=','>','>='].includes(operator)){
            ASM.addCode(`jp ${falseLabel}`)
        }else if(float&&['!=','!=='].includes(operator)){
            ASM.addCode(`jp ${trueLabel}`)
        }
        ASM.addCode(`${jumps[operator]} ${trueLabel}`)
        ASM.addCode(`jmp ${falseLabel}`)
    }

    asm(ASM:Asm){
        if(!this.condition||!this.thenBranch){
            throw new Error('If statement is not initialized')
        }
        const thenLabel = nextLabel('then')
        const elseLabel = nextLabel('else')
        const endLabel = nextLabel('end')
        this.emitBranch(this.condition,ASM,thenLabel,elseLabel)
        ASM.addCode(`${thenLabel}:`)
        this.thenBranch.asm(ASM)
        ASM.addCode(`jmp ${endLabel}`)
        ASM.addCode(`${elseLabel}:`)
        this.elseBranch?.asm(ASM)
        ASM.addCode(`${endLabel}:`)
    }

    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(token==='if'){
            tokenizer.move(-1)
            const statement = new Iff(active)
            statement.set(tokenizer)
            active.children.push(statement)
            return statement
        }
        tokenizer.move(-1)
        return null
    }
}

export default Iff
