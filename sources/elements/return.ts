import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from '../asm.ts'
import {emitExpression,parseExpression,type Expression} from '../maths.ts'
import Iff from './iff.ts'
import Call from './call.ts'
import Invoke,{isInvoke} from './invoke.ts'
import DataElement from './dataElement.ts'
import {stringData} from '../stringLiteral.ts'

let returnConditionId = 0
let returnStringId = 0

export class Return extends Base{
    expression:Expression|null = null
    condition:Iff|null = null
    call:Call|Invoke|null = null
    arrayValue:DataElement|null = null
    classValue:DataElement|null = null
    stringValue:string|null = null
    stringData:DataElement|null = null

    constructor(parent:Base){
        super(parent)
    }

    set(tokenizer:Tokenizer){
        tokenizer.get()
        const tokens:string[] = []
        while(tokenizer.has()){
            const token = tokenizer.get()
            if(token==='\n'||token===';'){
                break
            }
            if(token==='}'){
                tokenizer.move(-1)
                break
            }
            tokens.push(token)
        }
        const expression = tokens.join('').replace(/;$/,'')
        let functionScope = this.parent
        while(functionScope&&!functionScope.isFunctionScope){
            functionScope = functionScope.parent
        }
        if(functionScope){
            functionScope.returnThis = (functionScope.returnThis??true)
                &&expression==='this'
                &&Boolean(this.classElement)
        }
        const inferReturnType = (type:string|null|undefined)=>{
            if(functionScope&&!functionScope.returnType&&type){
                functionScope.returnType = type
            }
        }
        if(expression){
            if(expression==='this'){
                if(!this.classElement){
                    throw new Error('Cannot return this outside a class method')
                }
                this.returnThis = true
                if(functionScope){
                    if(functionScope.returnClassType&&functionScope.returnClassType!==this.classElement.name){
                        throw new Error('Function cannot return values of different classes')
                    }
                    functionScope.returnClassType = this.classElement.name
                    inferReturnType(this.classElement.name)
                }
            }else if(Iff.isConditionExpression(expression)){
                this.condition = new Iff(this)
                this.condition.condition = this.condition.parseCondition(expression)
            }else{
                const returnedData = this.parent?.getData(expression)
                if(returnedData?.classType&&!returnedData.isArray
                    ||returnedData?.type==='ArrayBuffer'&&!returnedData.isArray){
                    this.classValue = returnedData
                    if(functionScope){
                        let valueScope = this.parent
                        while(valueScope){
                            if(valueScope.DATA.includes(returnedData)){
                                if(!returnedData.isParameter){
                                    returnedData.isHeapAllocated = true
                                }
                                break
                            }
                            if(valueScope===functionScope){
                                break
                            }
                            valueScope = valueScope.parent
                        }
                        if(functionScope.returnClassType&&functionScope.returnClassType!==returnedData.classType){
                            throw new Error('Function cannot return values of different classes')
                        }
                        functionScope.returnClassType = returnedData.classType
                        const returnedClass = returnedData.classType
                            ?functionScope.getClass(returnedData.classType)
                            :null
                        for(let scope=functionScope.parent;scope;scope=scope.parent){
                            if(returnedClass&&!scope.CLASSES.some(item=>item.name===returnedClass.name)){
                                scope.addClass(returnedClass)
                            }
                        }
                    }
                    inferReturnType(returnedData.type==='ArrayBuffer'
                        ?'ArrayBuffer'
                        :returnedData.classType)
                }else if(returnedData?.type==='string'&&!returnedData.isArray){
                    this.stringData = returnedData
                    inferReturnType('string')
                }else{
                    const stringLiteral = expression.match(/^(['"])(?:\\.|(?!\1).)*\1$/s)
                    if(stringLiteral){
                        this.stringValue = stringLiteral[0]
                        inferReturnType('string')
                    }
                    const callSyntax = expression.match(/^([a-z_$][\w.$]*)\([\s\S]*\)$/i)
                    if(!this.stringValue&&callSyntax){
                        const [,name] = callSyntax
                        const callTokenizer = new Tokenizer(expression)
                        const call = isInvoke(name)
                            ? new Invoke(this)
                            : new Call(this)
                        call.set(callTokenizer)
                        if(!callTokenizer.has()){
                            this.call = call
                        }
                    }
                    if(this.call instanceof Call&&this.call.func&&functionScope){
                        const returnClassType = this.call.func.returnClassType
                            ??(this.call.func.returnType
                                ?functionScope.getClass(this.call.func.returnType)?.name??null
                                :null)
                        if(returnClassType){
                            if(functionScope.returnClassType&&functionScope.returnClassType!==returnClassType){
                                throw new Error('Function cannot return values of different classes')
                            }
                            functionScope.returnClassType = returnClassType
                        }
                        if(this.call.func.returnArrayType){
                            functionScope.returnArrayType = this.call.func.returnArrayType
                            functionScope.returnArrayNumericKind = this.call.func.returnArrayNumericKind
                        }
                        inferReturnType(this.call.func.returnType??returnClassType??this.call.func.returnArrayType)
                    }
                    if(!this.call&&!this.stringValue){
                        const array = this.parent?.getData(expression)
                        if(array?.isArray){
                            if(!array.dynamicArray){
                                throw new Error('Only dynamic arrays can be returned from functions')
                            }
                            this.arrayValue = array
                            array.isReturnedArray = true
                            let functionScope = this.parent
                            while(functionScope&&!functionScope.isFunctionScope){
                                functionScope = functionScope.parent
                            }
                            if(functionScope){
                                const returnArrayType = `${array.type}[]`
                                if(functionScope.returnArrayType&&functionScope.returnArrayType!==returnArrayType){
                                    throw new Error('Function cannot return arrays of different types')
                                }
                                functionScope.returnArrayType = returnArrayType
                                functionScope.returnArrayNumericKind = array.numericKind
                            }
                            inferReturnType(`${array.type}[]`)
                        }else{
                            this.expression = parseExpression(expression,this)
                            const type = expression==='true'||expression==='false'
                                ||returnedData?.type==='boolean'
                                ?'boolean'
                                :'number'
                            inferReturnType(type)
                        }
                    }
                }
            }
        }
    }

    asm(ASM:Asm){
        if(this.condition?.condition){
            const id = ++returnConditionId
            const trueLabel = `__ds_return_true_${id}`
            const falseLabel = `__ds_return_false_${id}`
            const endLabel = `__ds_return_end_${id}`
            this.condition.emitBranch(this.condition.condition,ASM,trueLabel,falseLabel)
            ASM.addCode(`${trueLabel}:`)
            ASM.addCode('mov rax, 1')
            ASM.addCode(`jmp ${endLabel}`)
            ASM.addCode(`${falseLabel}:`)
            ASM.addCode('xor rax, rax')
            ASM.addCode(`${endLabel}:`)
        }else if(this.returnThis){
            ASM.addCode('mov rax, rsi')
        }else if(this.call){
            this.call.asm(ASM)
        }else if(this.arrayValue){
            const name = this.arrayValue.getAccessName()
            ASM.addCode(this.arrayValue.isParameter
                ? `mov rax, ${name}`
                : `lea rax, [${name}]`)
        }else if(this.classValue){
            const value = this.classValue
            ASM.addCode(value.type==='ArrayBuffer'||value.isHeapAllocated
                ? `mov rax, [${value.name}]`
                : value.isParameter
                    ? `mov rax, ${value.name}`
                    : `lea rax, [${value.name}]`)
        }else if(this.stringValue!==null){
            const label = `__ds_return_string_${++returnStringId}`
            ASM.addData(`${label} ${stringData(this.stringValue.slice(1,-1))}`)
            ASM.addCode(`lea rax, [${label}]`)
        }else if(this.stringData){
            ASM.addCode(this.stringData.isParameter
                ? `mov rax, ${this.stringData.name}`
                : `mov rax, [${this.stringData.getAccessName()}]`)
        }else if(this.expression){
            emitExpression(this.expression,ASM)
        }
        let parent = this.parent
        while(parent&&!parent.returnLabel){
            parent = parent.parent
        }
        if(!parent?.returnLabel){
            throw new Error('Return statement is only valid inside a function')
        }
        ASM.addCode(`jmp ${parent.returnLabel}`)
    }

    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(token==='return'||token==='return;'){
            tokenizer.move(-1)
            const statement = new Return(active)
            statement.set(tokenizer)
            active.children.push(statement)
            return statement
        }
        tokenizer.move(-1)
        return null
    }
}

export default Return
