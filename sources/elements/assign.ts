import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from './../asm.ts'
import DataElement from './dataElement.ts'
import {emitExpression, parseExpression, type Expression} from '../maths.ts'

let stringAssignId = 0

export class Assign extends Base{
    target:DataElement|null = null
    expression:Expression|null = null
    targetIndex:Expression|null = null
    stringValue:string|null = null
    stringSource:DataElement|null = null
    stringSourceIndex:Expression|null = null
    constructor(parent:Base){
        super(parent)
    }
    setExpression(target:DataElement,expression:string,initializer=false,indexText?:string){
        const isStringArray = target.isArray && (target.type==='string'||target.type==='string[]')
        if(!initializer&&target.kind==='const'){
            throw new Error(`Cannot assign to constant "${target.name}"`)
        }
        if(target.isArray&&!indexText){
            throw new Error(`Array "${target.name}" must be assigned through an index`)
        }
        if((target.type==='string'||target.type==='string[]')&&(!target.isArray||!indexText)){
            throw new Error('String assignment is only supported for string array elements')
        }
        if((target.type!=='number'&&!target.isArray)&&(target.type!=='string'&&target.type!=='string[]')){
            throw new Error('Assignment is only supported for number variables and string array elements')
        }
        this.target = target
        if(isStringArray){
            const value = expression.trim()
            const stringLiteral = value.match(/^(['"])(?:\\.|(?!\1).)*\1$/s)
            if(stringLiteral){
                this.stringValue = value
                if(indexText){
                    this.targetIndex = parseExpression(indexText,this.parent!)
                    if(this.targetIndex.numericKind!=='integer'){
                        throw new Error('Array index must be an integer')
                    }
                }
                return
            }
            const arrayMember = value.match(/^([a-z_$][\w.$]*)\[([^\]]+)\]$/i)
            if(arrayMember){
                const source = this.parent?.getData(arrayMember[1])
                if(source&&source.isArray&&(source.type==='string'||source.type==='string[]')){
                    this.stringSource = source
                    this.stringSourceIndex = parseExpression(arrayMember[2],this.parent!)
                    if(this.stringSourceIndex.numericKind!=='integer'){
                        throw new Error('Array index must be an integer')
                    }
                    if(indexText){
                        this.targetIndex = parseExpression(indexText,this.parent!)
                        if(this.targetIndex.numericKind!=='integer'){
                            throw new Error('Array index must be an integer')
                        }
                    }
                    return
                }
            }
            const source = this.parent?.getData(value)
            if(source&&source.type==='string'&&!source.isArray){
                this.stringSource = source
                if(indexText){
                    this.targetIndex = parseExpression(indexText,this.parent!)
                    if(this.targetIndex.numericKind!=='integer'){
                        throw new Error('Array index must be an integer')
                    }
                }
                return
            }
            throw new Error(`String array assignment requires a string literal, string variable, or string-array element: "${expression}"`)
        }
        this.expression = parseExpression(expression,this.parent!)
        if(indexText){
            this.targetIndex = parseExpression(indexText,this.parent!)
            if(this.targetIndex.numericKind!=='integer'){
                throw new Error('Array index must be an integer')
            }
        }
        target.numericKind = target.numericKind==='float'||this.expression.numericKind==='float'
            ? 'float'
            : 'integer'
    }
    set(tokenizer:Tokenizer){
        const tokens:string[] = []
        let token:string
        while(!['\n',';'].includes(token = tokenizer.get())){
            tokens.push(token)
        }
        const statement = tokens.join('').replace(/;$/,'')
        const match = statement.match(/^([a-z_$][\w.$]*)(?:\[([^\]]+)\])?=(.+?);?$/i)
        if(!match){
            throw new Error('Invalid assignment')
        }
        const [,targetName,indexText,expression] = match
        const target = this.parent?.getData(targetName)
        if(!target){
            throw new Error(`Unknown assignment target "${targetName}"`)
        }
        this.setExpression(target,expression,false,indexText)
    }
    asm(ASM:Asm){
        if(!this.target){
            throw new Error('Assignment is not initialized')
        }
        if(this.target.isArray && (this.target.type==='string'||this.target.type==='string[]')){
            if(this.targetIndex){
                emitExpression(this.targetIndex,ASM)
                ASM.addCode('shl rax, 3')
                if(this.target.isParameter){
                    ASM.addCode(`mov rdx, ${this.target.name}`)
                }else{
                    ASM.addCode(`lea rdx, [${this.target.name}]`)
                }
                ASM.addCode('add rdx, rax')
                ASM.addCode('push rdx')
            }
            const valueLabel = this.stringValue
                ? `__ds_str_assign_${++stringAssignId}`
                : null
            if(this.stringValue){
                ASM.addData(`${valueLabel} db ${this.stringValue},0`)
                ASM.addCode(`lea rax, [${valueLabel}]`)
            }else if(this.stringSourceIndex&&this.stringSource){
                emitExpression(this.stringSourceIndex,ASM)
                ASM.addCode('shl rax, 3')
                ASM.addCode(`lea rdx, [${this.stringSource.name}]`)
                ASM.addCode('add rdx, rax')
                ASM.addCode('mov rax, [rdx]')
            }else if(this.stringSource){
                ASM.addCode(`lea rax, [${this.stringSource.name}]`)
            }
            if(this.targetIndex){
                ASM.addCode('pop rdx')
                ASM.addCode('mov [rdx], rax')
                return
            }
            throw new Error('String array assignment is not initialized')
        }
        if(!this.expression){
            throw new Error('Assignment is not initialized')
        }
        if(this.targetIndex){
            emitExpression(this.targetIndex,ASM)
            ASM.addCode('shl rax, 3')
            if(this.target!.isParameter){
                ASM.addCode(`mov rdx, ${this.target!.name}`)
            }else{
                ASM.addCode(`lea rdx, [${this.target!.name}]`)
            }
            ASM.addCode('add rdx, rax')
            ASM.addCode('push rdx')
        }
        emitExpression(this.expression,ASM)
        if(this.targetIndex){
            ASM.addCode('pop rdx')
            if(this.expression.numericKind==='float'||this.target.numericKind==='float'){
                if(this.expression.numericKind==='integer'){
                    ASM.addCode('cvtsi2sd xmm0, rax')
                }
                ASM.addCode('movsd qword [rdx], xmm0')
            }else{
                ASM.addCode('mov [rdx], rax')
            }
            return
        }
        if(this.expression.numericKind==='float'){
            ASM.addCode(`movsd qword [${this.target.name}], xmm0`)
        }else if(this.target.numericKind==='float'){
            ASM.addCode('cvtsi2sd xmm0, rax')
            ASM.addCode(`movsd qword [${this.target.name}], xmm0`)
        }else{
            ASM.addCode(`mov [${this.target.name}], rax`)
        }
    }
    static test(active:Base,tokenizer:Tokenizer){
        const first = tokenizer.get()
        const second = tokenizer.get()
        tokenizer.move(-2)
        const compactAssignment = first.match(/^([a-z_$][\w.$]*(?:\[[^\]]+\])?)=/i)
        const targetName = second==='='
            ? first
            : compactAssignment?.[1]
        const dataName = targetName?.match(/^([a-z_$][\w.$]*)/i)?.[1]
        if(dataName&&active.getData(dataName)){
            const data = new Assign(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        return null
    }
}

export default Assign
