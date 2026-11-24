import Tokenizer from '../tokenizer.ts'
import Asm from '../asm.ts'
import Make from '../make.ts'
import Base from './base.ts'
import DataElement from './dataElement.ts'
import Iff from './iff.ts'
import type {Condition, ParsedOperand, StringOperand} from './iff/types.ts'
import {nextLabel} from './iff/ids.ts'

type SwitchCase = {
    value:ParsedOperand|null
    body:Base
    label:string
}

export class Switch extends Iff{
    selector:ParsedOperand|null = null
    cases:SwitchCase[] = []
    endLabel = nextLabel('switch_end')

    constructor(parent:Base){
        super(parent)
        this.breakLabel = this.endLabel
    }

    set(tokenizer:Tokenizer){
        if(tokenizer.get()!=='switch'||tokenizer.get()!=='('){
            throw new Error('Invalid switch statement')
        }
        const selectorTokens = tokenizer.getCallArguments()
        if(selectorTokens.length!==1){
            throw new Error('Switch expression must be a single value')
        }
        this.selector = this.parseOperand(selectorTokens[0])

        let next = tokenizer.get()
        while(next==='\n'){
            next = tokenizer.get()
        }
        if(next!=='{'){
            throw new Error('Expected "{" after switch expression')
        }
        tokenizer.move(-1)
        const tokens = tokenizer.getBlock()
        this.parseCases(tokens.slice(1,-1))
    }

    parseCases(tokens:string[]){
        let index = 0
        let hasDefault = false
        while(index<tokens.length){
            while(tokens[index]==='\n'||tokens[index]===';'){
                index++
            }
            if(index>=tokens.length){
                break
            }
            const start = index
            const kind = tokens[index]
            if(kind!=='case'&&kind!=='default'){
                throw new Error(`Expected "case" or "default" in switch, received "${kind}"`)
            }
            index++
            const labelTokens:string[] = []
            while(index<tokens.length&&tokens[index]!==':'){
                labelTokens.push(tokens[index++])
            }
            if(tokens[index]!==':'){
                throw new Error('Expected ":" after switch case')
            }
            index++
            if(kind==='default'&&hasDefault){
                throw new Error('Switch statement cannot have multiple default clauses')
            }
            hasDefault ||= kind==='default'

            const bodyTokens:string[] = []
            let depth = 0
            while(index<tokens.length){
                const token = tokens[index]
                const previous = tokens[index-1]
                if(depth===0
                    &&(token==='case'||token==='default')
                    &&(index===start||previous==='\n'||previous===';')){
                    break
                }
                if(token==='{'){
                    depth++
                }else if(token==='}'){
                    depth--
                }
                bodyTokens.push(token)
                index++
            }
            if(kind==='default'&&labelTokens.length){
                throw new Error('Default clause cannot have a value')
            }
            if(kind==='case'&&!labelTokens.length){
                throw new Error('Case clause must have a value')
            }
            const value = kind==='case'
                ? this.parseOperand(labelTokens.join(''))
                : null
            if(value&&this.selector
                &&this.isStringOperand(value.value)!==this.isStringOperand(this.selector.value)){
                throw new Error('Switch expression and case value must have matching types')
            }
            const branch = new Base(this)
            const branchTokenizer = new Tokenizer('')
            branchTokenizer.tokens = bodyTokens
            Make.compile(new Asm(),branch,branchTokenizer)
            this.cases.push({value,body:branch,label:nextLabel('switch_case')})
        }
    }

    prepareFunctionCalls(){
        super.prepareFunctionCalls()
        const prepareOperand = (operand:ParsedOperand|null)=>{
            operand?.calls.forEach(({call})=>call.prepareDynamicArrayArguments())
        }
        prepareOperand(this.selector)
        this.cases.forEach(({value,body})=>{
            prepareOperand(value)
            body.prepareFunctionCalls()
        })
    }

    asm(ASM:Asm){
        if(!this.selector){
            throw new Error('Switch statement is not initialized')
        }
        const selectorIsString = this.isStringOperand(this.selector.value)
        const selectorIsFloat = this.isFloatOperand(this.selector.value)
        const selectorTemp = new DataElement(
            'let',
            nextLabel('switch_value'),
            selectorIsString?'string':'number',
            '0'
        )
        if(selectorIsFloat){
            selectorTemp.numericKind = 'float'
        }
        this.addData(selectorTemp)

        this.emitCalls(this.selector.calls,ASM)
        this.emitOperand(this.selector.value,ASM)
        ASM.addData(`${selectorTemp.name} dq 0`)
        ASM.addCode(selectorIsFloat
            ? `movsd [${selectorTemp.name}], xmm0`
            : `mov [${selectorTemp.name}], rax`)

        const selectorValue:StringOperand|ReturnType<typeof this.parseOperand>['value'] = selectorIsString
            ? {kind:'data',value:selectorTemp}
            : this.parseOperand(selectorTemp.name!).value
        const defaultCase = this.cases.find(item=>item.value===null)
        const checks = this.cases.filter((item):item is SwitchCase&{value:ParsedOperand}=>item.value!==null)
        checks.forEach((item,index)=>{
            const nextCheckLabel = index===checks.length-1
                ? defaultCase?.label??this.endLabel
                : nextLabel('switch_check')
            const condition:Condition = {
                kind:'compare',
                left:selectorValue,
                right:item.value.value,
                operator:'===',
                calls:item.value.calls
            }
            this.emitBranch(condition,ASM,item.label,nextCheckLabel)
            if(index<checks.length-1){
                ASM.addCode(`${nextCheckLabel}:`)
            }
        })
        if(!checks.length){
            ASM.addCode(`jmp ${defaultCase?.label??this.endLabel}`)
        }
        for(const item of this.cases){
            ASM.addCode(`${item.label}:`)
            item.body.asm(ASM)
        }
        ASM.addCode(`${this.endLabel}:`)
    }

    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(token==='switch'){
            tokenizer.move(-1)
            const statement = new Switch(active)
            statement.set(tokenizer)
            active.children.push(statement)
            return statement
        }
        tokenizer.move(-1)
        return null
    }
}

export default Switch
