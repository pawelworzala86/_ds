import Tokenizer from '../tokenizer.ts'
import Asm from '../asm.ts'
import Make from '../make.ts'
import Base from './base.ts'
import Call from './call.ts'
import DataElement from './dataElement.ts'
import {parseExpression,type Expression} from '../maths.ts'
import type {Condition, ConditionCall, ParsedOperand, StringOperand} from './iff/types.ts'
import {isWrapped, findTopLevel, findComparison, findClosingParenthesis} from './iff/scan.ts'
import {nextLabel} from './iff/ids.ts'
import {isStringOperand, isFloatOperand, emitCalls, emitOperand, emitBranch, emitComparisonJump} from './iff/emit.ts'

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

    prepareFunctionCalls(){
        super.prepareFunctionCalls()
        const prepareCondition = (condition:Condition|null)=>{
            if(!condition){
                return
            }
            if(condition.kind==='and'||condition.kind==='or'){
                prepareCondition(condition.left)
                prepareCondition(condition.right)
            }else if(condition.kind==='not'){
                prepareCondition(condition.value)
            }else if(condition.kind==='compare'||condition.kind==='truthy'){
                condition.calls.forEach(({call})=>call.prepareDynamicArrayArguments())
            }
        }
        prepareCondition(this.condition)
        this.thenBranch?.prepareFunctionCalls()
        this.elseBranch?.prepareFunctionCalls()
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
        index = findTopLevel(text,' instanceof ')
        if(index!==-1){
            const instanceName = text.slice(0,index).trim()
            const className = text.slice(index+' instanceof '.length).trim()
            const instance = this.getData(instanceName)
            const targetClass = this.getClass(className)
            if(!instance?.classType){
                throw new Error(`Left operand "${instanceName}" of instanceof must be a class instance`)
            }
            if(!targetClass){
                throw new Error(`Unknown class "${className}" in instanceof condition`)
            }
            let instanceClass = this.getClass(instance.classType)
            while(instanceClass&&instanceClass.name!==targetClass.name){
                instanceClass = instanceClass.parentClass
            }
            return {kind:'boolean',value:instanceClass!==null}
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
        const typeofMatch = text.match(/^typeof\s+(.+)$/)
        if(typeofMatch){
            const subject = typeofMatch[1].trim()
            let type:string|null = null
            if((subject.startsWith("'")&&subject.endsWith("'"))||(subject.startsWith('"')&&subject.endsWith('"'))){
                type = 'string'
            }else if(/^(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(subject)){
                type = 'number'
            }else if(subject==='true'||subject==='false'){
                type = 'boolean'
            }else{
                const subjectData = this.getData(subject)
                if(!subjectData){
                    throw new Error(`Unknown value "${subject}" in typeof expression`)
                }
                if(subjectData.classType||subjectData.isArray){
                    type = 'object'
                }else if(subjectData.type==='number'||subjectData.type==='string'){
                    type = subjectData.type
                }else if(subjectData.type==='boolean'){
                    type = 'boolean'
                }else if(subjectData.type==='Function'){
                    type = 'function'
                }
            }
            if(!type){
                throw new Error(`Unsupported typeof operand "${subject}"`)
            }
            return {value:{kind:'literal',value:`'${type}'`},calls:[]}
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
        return isStringOperand(this,value)
    }

    isFloatOperand(value:Expression|StringOperand){
        return isFloatOperand(this,value)
    }

    emitCalls(calls:ConditionCall[],ASM:Asm){
        emitCalls(this,calls,ASM)
    }

    emitOperand(value:Expression|StringOperand,ASM:Asm){
        emitOperand(this,value,ASM)
    }

    emitBranch(condition:Condition,ASM:Asm,trueLabel:string,falseLabel:string){
        emitBranch(this,condition,ASM,trueLabel,falseLabel)
    }

    emitComparisonJump(operator:string,ASM:Asm,trueLabel:string,falseLabel:string,float:boolean){
        emitComparisonJump(this,operator,ASM,trueLabel,falseLabel,float)
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
