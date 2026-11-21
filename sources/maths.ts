import Base from './elements/base.ts'
import Asm from './asm.ts'
import DataElement, {getNumericKind, type NumericKind} from './elements/dataElement.ts'
import {getClassPropertyAccess, getClassPropertyOffset} from './elements/clasElement.ts'

type BinaryOperator = '+'|'-'|'*'|'/'|'%'|'**'
type MathFunctionName = 'sin'|'cos'|'tan'|'asin'|'acos'|'atan'|'atan2'|'sqrt'|'pow'|'fmod'|'exp'|'log'|'log10'|'ceil'|'floor'|'fabs'
const mathFunctions:MathFunctionName[] = ['sin','cos','tan','asin','acos','atan','atan2','sqrt','pow','fmod','exp','log','log10','ceil','floor','fabs']

export function isMathFunction(name:string):name is MathFunctionName{
    return mathFunctions.includes(name as MathFunctionName)
}

export type Expression =
    | {kind:'number',value:string,numericKind:NumericKind}
    | {kind:'data',value:DataElement,numericKind:NumericKind}
    | {kind:'stringLength',value:DataElement,numericKind:'integer'}
    | {kind:'arrayLength',value:DataElement,numericKind:'integer'}
    | {kind:'index',value:DataElement,index:Expression,numericKind:NumericKind}
    | {kind:'unary',operator:'+'|'-',value:Expression,numericKind:NumericKind}
    | {kind:'binary',operator:BinaryOperator,left:Expression,right:Expression,numericKind:NumericKind}
    | {kind:'mathCall',name:MathFunctionName,arguments:Expression[],numericKind:'float'}

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
    const leftValue = nextLabel('float_arg')
    ASM.addData(`${leftValue} dq 0`)
    ASM.addCode(`movsd qword [${leftValue}], xmm0`)
    emitAsFloat(expression.right,ASM)
    ASM.addCode('movsd xmm1, xmm0')
    ASM.addCode(`movsd xmm0, qword [${leftValue}]`)

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

export function parseExpression(text:string,active:Base):Expression{
    const tokens = text.match(/0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?|[a-z_$][\w.$]*|\*\*|,|[()[\]+\-*/%]/gi)??[]
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
        if(isMathFunction(token)&&current()==='('){
            const name = token as MathFunctionName
            const expectedArguments = ['atan2','pow','fmod'].includes(name)?2:1
            index++
            const args:Expression[] = []
            if(current()!==')'){
                do{
                    args.push(parseAdditive())
                    if(current()!==','){
                        break
                    }
                    index++
                }while(true)
            }
            if(current()!==')'){
                throw new Error(`Unclosed argument list for Math.${name}`)
            }
            index++
            if(args.length!==expectedArguments){
                throw new Error(`Math.${name} expects ${expectedArguments} argument${expectedArguments===1?'':'s'}, received ${args.length}`)
            }
            return {kind:'mathCall',name,arguments:args,numericKind:'float'}
        }
        if(/^(?:0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?)$/i.test(token)){
            return {kind:'number',value:token,numericKind:getNumericKind(token)}
        }
        const stringLength = token.match(/^([a-z_$][\w$]*)\.length$/i)
        if(stringLength){
            const value = active.getData(stringLength[1])
            if(value?.type==='string'&&!value.isArray){
                return {kind:'stringLength',value,numericKind:'integer'}
            }
            if(value?.isArray&&value.dynamicArray){
                return {kind:'arrayLength',value,numericKind:'integer'}
            }
        }
        const access = getClassPropertyAccess(active,token)
        const data = active.getData(token)??(access
            ? new DataElement('let',`${access.instance.name}.${access.path}`,access.property.type??'',access.property.value??'')
            : null)
        if(!data){
            throw new Error(`Unknown numeric value "${token}"`)
        }
        if(access){
            data.classType = access.property.classType
            data.isArray = access.property.isArray
            data.numericKind = access.property.numericKind
            data.classPropertyInstance = access.instance
            data.classPropertyPath = access.path
            if(access.instance.classType){
                const classType = active.getClass(access.instance.classType)
                data.classPropertyOffset = classType
                    ? getClassPropertyOffset(classType,token.split('.').slice(1).join('.'),name=>active.getClass(name))
                    : null
                if(data.classPropertyOffset===null){
                    throw new Error(`Unable to resolve local struct property "${access.path}"`)
                }
            }
        }
        if(tokens[index]==='['){
            if(!data.isArray&&data.type!=='number'){
                throw new Error(`Value "${token}" is not an array`)
            }
            index++
            const arrayIndex = parseAdditive()
            if(tokens[index++]!==']'){
                throw new Error(`Unclosed index for array "${token}"`)
            }
            if(arrayIndex.numericKind!=='integer'){
                throw new Error('Array index must be an integer')
            }
            return {kind:'index',value:data,index:arrayIndex,numericKind:data.isArray?data.numericKind:'float'}
        }
        if(data.isArray){
            throw new Error(`Array "${token}" must be accessed with an index`)
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

export function emitExpression(expression:Expression,ASM:Asm){
    if(expression.kind==='number'){
        if(expression.numericKind==='float'){
            emitFloatLiteral(ASM,expression.value)
            return
        }
        ASM.addCode(`mov rax, ${expression.value}`)
        return
    }
    if(expression.kind==='mathCall'){
        emitAsFloat(expression.arguments[0],ASM)
        if(expression.arguments.length===2){
            const firstArgument = nextLabel('float_arg')
            ASM.addData(`${firstArgument} dq 0`)
            ASM.addCode(`movsd qword [${firstArgument}], xmm0`)
            emitAsFloat(expression.arguments[1],ASM)
            ASM.addCode('movsd xmm1, xmm0')
            ASM.addCode(`movsd xmm0, qword [${firstArgument}]`)
        }
        emitFloatCall(ASM,expression.name)
        return
    }
    if(expression.kind==='stringLength'){
        const value = expression.value.getCode(true)
        if(value===null){
            throw new Error('Unable to resolve string length')
        }
        if(value.startsWith('addr ')){
            ASM.addCode(`lea rcx, [${value.replace(/^addr\s+/,'')}]`)
        }else{
            ASM.addCode(`mov rcx, ${value}`)
        }
        ASM.addImport('msvcrt','strlen')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [strlen]')
        ASM.addCode('add rsp, 40')
        return
    }
    if(expression.kind==='arrayLength'){
        if(expression.value.isParameter){
            ASM.addCode(`mov rdx, ${expression.value.name}`)
            ASM.addCode('mov rax, [rdx+8]')
        }else{
            ASM.addCode(`mov rax, [${expression.value.name}__length]`)
        }
        return
    }
    if(expression.kind==='data'){
        if(expression.value.isConstAlias){
            ASM.addCode(`mov rax, ${expression.value.name}`)
            return
        }
        const instance = expression.value.classPropertyInstance
        const offset = expression.value.classPropertyOffset
        if(instance?.isProcedureLocal&&offset!==null){
            ASM.addCode(instance.isHeapAllocated
                ? `mov rdx, [${instance.name}]`
                : `lea rdx, [${instance.name}]`)
            if(offset){
                ASM.addCode(`add rdx, ${offset}`)
            }
            ASM.addCode(expression.numericKind==='float'
                ? 'movsd xmm0, qword [rdx]'
                : 'mov rax, [rdx]')
            return
        }
        const parameterValue = expression.value.isParameter&&!expression.value.isArray&&!instance
        if(expression.numericKind==='float'){
            ASM.addCode(parameterValue
                ? `movsd xmm0, qword ${expression.value.getAccessName()}`
                : `movsd xmm0, qword [${expression.value.getAccessName()}]`)
            return
        }
        ASM.addCode(parameterValue
            ? `mov rax, ${expression.value.getAccessName()}`
            : `mov rax, [${expression.value.getAccessName()}]`)
        return
    }
    if(expression.kind==='index'){
        emitExpression(expression.index,ASM)
        ASM.addCode('shl rax, 3')
        const instance = expression.value.classPropertyInstance
        const offset = expression.value.classPropertyOffset
        if(!expression.value.isArray){
            if(instance?.isProcedureLocal&&offset!==null){
                ASM.addCode(instance.isHeapAllocated
                    ? `mov rdx, [${instance.name}]`
                    : `lea rdx, [${instance.name}]`)
                if(offset){
                    ASM.addCode(`add rdx, ${offset}`)
                }
                ASM.addCode('mov rdx, [rdx]')
            }else if(expression.value.isParameter){
                ASM.addCode(`mov rdx, ${expression.value.getAccessName()}`)
            }else if(expression.value.isConstAlias){
                ASM.addCode(`mov rdx, ${expression.value.name}`)
            }else{
                ASM.addCode(`mov rdx, [${expression.value.getAccessName()}]`)
            }
        }else if(instance?.isProcedureLocal&&offset!==null){
            ASM.addCode(`lea rdx, [${instance.name}]`)
            if(offset){
                ASM.addCode(`add rdx, ${offset}`)
            }
            ASM.addCode('add rdx, rax')
        }else if(expression.value.isParameter){
            ASM.addCode(`mov rdx, ${expression.value.getAccessName()}`)
            if(expression.value.dynamicArray){
                ASM.addCode('mov rdx, [rdx]')
            }
        }else if(expression.value.dynamicArray){
            ASM.addCode(`mov rdx, [${expression.value.getAccessName()}]`)
        }else{
            ASM.addCode(`lea rdx, [${expression.value.getAccessName()}]`)
        }
        ASM.addCode('add rdx, rax')
        if(expression.numericKind==='float'){
            ASM.addCode('movsd xmm0, qword [rdx]')
        }else{
            ASM.addCode('mov rax, [rdx]')
        }
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
