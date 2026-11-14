import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from './../asm.ts'
import DataElement, {getNumericKind} from './dataElement.ts'

type BinaryOperator = '+'|'-'|'*'|'/'|'%'|'**'
type NumericKind = 'integer'|'float'

type Expression =
    | {kind:'number',value:string,numericKind:NumericKind}
    | {kind:'data',value:DataElement,numericKind:NumericKind}
    | {kind:'unary',operator:'+'|'-',value:Expression,numericKind:NumericKind}
    | {kind:'binary',operator:BinaryOperator,left:Expression,right:Expression,numericKind:NumericKind}

let labelId = 0

function nextLabel(prefix:string){
    return `__ds_math_${prefix}_${++labelId}`
}

function emitNegate(ASM:Asm,register:string){
    ASM.addCode(`neg ${register}`)
}

function emitMultiply(ASM:Asm,left:string,right:string){
    if(left!=='rax'){
        ASM.addCode(`mov rax, ${left}`)
    }
    ASM.addCode(`imul rax, ${right}`)
}

function emitFloatLiteral(ASM:Asm,value:string,register='xmm0'){
    const label = nextLabel('float')
    const literal = /e/i.test(value)&&!/[f]$/i.test(value)?`${value}f`:value
    ASM.addData(`${label} dq ${literal}`)
    ASM.addCode(`movsd ${register}, qword [${label}]`)
}

function emitAsFloat(expression:Expression,ASM:Asm){
    emitExpression(expression,ASM)
    if(expression.numericKind==='integer'){
        ASM.addCode('cvtsi2sd xmm0, rax')
    }
}

function addRuntimeImport(ASM:Asm,name:string){
    const functions = ASM.imp.msvcrt??[]
    if(!functions.includes(name)){
        ASM.addImport('msvcrt',name)
    }
}

function emitFloatCall(ASM:Asm,name:string){
    addRuntimeImport(ASM,name)
    ASM.addCode('sub rsp, 40')
    ASM.addCode(`call [${name}]`)
    ASM.addCode('add rsp, 40')
}

function emitFloatExpression(expression:Extract<Expression,{kind:'binary'}>,ASM:Asm){
    emitAsFloat(expression.left,ASM)
    ASM.addCode('sub rsp, 8')
    ASM.addCode('movsd qword [rsp], xmm0')
    emitAsFloat(expression.right,ASM)
    ASM.addCode('movsd xmm1, xmm0')
    ASM.addCode('movsd xmm0, qword [rsp]')
    ASM.addCode('add rsp, 8')

    switch(expression.operator){
        case '+':
            ASM.addCode('addsd xmm0, xmm1')
            break
        case '-':
            ASM.addCode('subsd xmm0, xmm1')
            break
        case '*':
            ASM.addCode('mulsd xmm0, xmm1')
            break
        case '/':
            ASM.addCode('divsd xmm0, xmm1')
            break
        case '%':
            emitFloatCall(ASM,'fmod')
            break
        case '**':
            emitFloatCall(ASM,'pow')
            break
    }
}

function parseExpression(text:string,active:Base):Expression{
    const tokens = text.match(/0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?|[a-z_$][\w.$]*|\*\*|[()+\-*/%]/gi)??[]
    if(!tokens.length||tokens.join('')!==text){
        throw new Error(`Invalid numeric expression "${text}"`)
    }

    let index = 0
    const current = ()=>tokens[index]

    function parsePrimary():Expression{
        const token = tokens[index++]
        if(token==='('){
            const value = parseAdditive()
            if(tokens[index++]!==')'){
                throw new Error('Unclosed parenthesis in numeric expression')
            }
            return value
        }
        if(!token){
            throw new Error('Expected a value in numeric expression')
        }
        if(/^(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(token)){
            return {kind:'number',value:token,numericKind:getNumericKind(token)}
        }
        const data = active.getData(token)
        if(!data){
            throw new Error(`Unknown numeric value "${token}"`)
        }
        if(data.type!=='number'){
            throw new Error(`Value "${token}" is not a number`)
        }
        return {kind:'data',value:data,numericKind:data.numericKind}
    }

    function parsePower():Expression{
        const left = parsePrimary()
        if(current()!=='**'){
            return left
        }
        index++
        const right = parseUnary()
        return {
            kind:'binary',
            operator:'**',
            left,
            right,
            numericKind:left.numericKind==='float'||right.numericKind==='float'?'float':'integer'
        }
    }

    function parseUnary():Expression{
        const operator = current()
        if(operator==='+'||operator==='-'){
            index++
            const value = parseUnary()
            return {kind:'unary',operator,value,numericKind:value.numericKind}
        }
        return parsePower()
    }

    function parseMultiplicative():Expression{
        let left = parseUnary()
        while(current()==='*'||current()==='/'||current()==='%'){
            const operator = tokens[index++] as BinaryOperator
            const right = parseUnary()
            left = {
                kind:'binary',
                operator,
                left,
                right,
                numericKind:left.numericKind==='float'||right.numericKind==='float'?'float':'integer'
            }
        }
        return left
    }

    function parseAdditive():Expression{
        let left = parseMultiplicative()
        while(current()==='+'||current()==='-'){
            const operator = tokens[index++] as BinaryOperator
            const right = parseMultiplicative()
            left = {
                kind:'binary',
                operator,
                left,
                right,
                numericKind:left.numericKind==='float'||right.numericKind==='float'?'float':'integer'
            }
        }
        return left
    }

    const expression = parseAdditive()
    if(index!==tokens.length){
        throw new Error(`Unexpected token "${tokens[index]}" in numeric expression`)
    }
    return expression
}

function emitSignedDivision(ASM:Asm,remainder:boolean){
    ASM.addCode('cqo')
    ASM.addCode('idiv rcx')
    if(remainder){
        ASM.addCode('mov rax, rdx')
    }
}

function emitPower(ASM:Asm){
    const prefix = nextLabel('pow')
    const nonnegative = `${prefix}_nonnegative`
    const loop = `${prefix}_loop`
    const skipMultiply = `${prefix}_skip_multiply`
    const calculated = `${prefix}_calculated`
    const done = `${prefix}_done`

    ASM.addCode('mov r8, rax')
    ASM.addCode('mov r9, rcx')
    ASM.addCode('mov r10, 0')
    ASM.addCode('test r9, r9')
    ASM.addCode(`jns ${nonnegative}`)
    emitNegate(ASM,'r9')
    ASM.addCode('mov r10, 1')
    ASM.addCode(`${nonnegative}:`)
    ASM.addCode('mov r11, 1')
    ASM.addCode(`${loop}:`)
    ASM.addCode('test r9, r9')
    ASM.addCode(`jz ${calculated}`)
    ASM.addCode('xor rdx, rdx')
    ASM.addCode('mov rax, r9')
    ASM.addCode('mov rcx, 2')
    ASM.addCode('div rcx')
    ASM.addCode('mov r9, rax')
    ASM.addCode('test rdx, rdx')
    ASM.addCode(`jz ${skipMultiply}`)
    ASM.addCode('imul r11, r8')
    ASM.addCode(`${skipMultiply}:`)
    ASM.addCode('imul r8, r8')
    ASM.addCode(`jmp ${loop}`)
    ASM.addCode(`${calculated}:`)
    ASM.addCode('mov rax, r11')
    ASM.addCode('test r10, r10')
    ASM.addCode(`jz ${done}`)
    ASM.addCode('mov rcx, rax')
    ASM.addCode('mov rax, 1')
    ASM.addCode('cqo')
    ASM.addCode('idiv rcx')
    ASM.addCode(`${done}:`)
}

function emitExpression(expression:Expression,ASM:Asm){
    if(expression.kind==='number'){
        if(expression.numericKind==='float'){
            emitFloatLiteral(ASM,expression.value)
            return
        }
        ASM.addCode(`mov rax, ${expression.value}`)
        return
    }
    if(expression.kind==='data'){
        if(expression.numericKind==='float'){
            ASM.addCode(`movsd xmm0, qword [${expression.value.name}]`)
            return
        }
        ASM.addCode(`mov rax, [${expression.value.name}]`)
        return
    }
    if(expression.kind==='unary'){
        emitExpression(expression.value,ASM)
        if(expression.operator==='-'){
            if(expression.numericKind==='float'){
                emitFloatLiteral(ASM,'-1.0','xmm1')
                ASM.addCode('mulsd xmm0, xmm1')
            }else{
                emitNegate(ASM,'rax')
            }
        }
        return
    }
    if(expression.numericKind==='float'){
        emitFloatExpression(expression,ASM)
        return
    }

    emitExpression(expression.left,ASM)
    ASM.addCode('push rax')
    emitExpression(expression.right,ASM)
    ASM.addCode('mov rcx, rax')
    ASM.addCode('pop rax')

    switch(expression.operator){
        case '+':
            ASM.addCode('add rax, rcx')
            break
        case '-':
            ASM.addCode('sub rax, rcx')
            break
        case '*':
            emitMultiply(ASM,'rax','rcx')
            break
        case '/':
            emitSignedDivision(ASM,false)
            break
        case '%':
            emitSignedDivision(ASM,true)
            break
        case '**':
            emitPower(ASM)
            break
    }
}

export class Assign extends Base{
    target:DataElement|null = null
    expression:Expression|null = null
    constructor(parent:Base){
        super(parent)
    }
    setExpression(target:DataElement,expression:string,initializer=false){
        if(!initializer&&target.kind==='const'){
            throw new Error(`Cannot assign to constant "${target.name}"`)
        }
        if(target.type!=='number'){
            throw new Error('Assignment is only supported for number variables')
        }
        this.target = target
        this.expression = parseExpression(expression,this.parent!)
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
        const match = statement.match(/^([a-z_$][\w.$]*)=(.+?);?$/i)
        if(!match){
            throw new Error('Invalid assignment')
        }
        const [,targetName,expression] = match
        const target = this.parent?.getData(targetName)
        if(!target){
            throw new Error(`Unknown assignment target "${targetName}"`)
        }
        this.setExpression(target,expression)
    }
    asm(ASM:Asm){
        if(!this.target||!this.expression){
            throw new Error('Assignment is not initialized')
        }
        emitExpression(this.expression,ASM)
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
        const compactAssignment = first.match(/^([a-z_$][\w.$]*)=/i)
        const targetName = second==='='
            ? first
            : compactAssignment?.[1]
        if(targetName&&active.getData(targetName)){
            const data = new Assign(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        return null
    }
}

export default Assign
