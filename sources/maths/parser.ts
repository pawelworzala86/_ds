import Base from '../elements/base.ts'
import DataElement, {getNumericKind} from '../elements/dataElement.ts'
import {getClassPropertyAccess, getClassPropertyOffset} from '../elements/clasElement.ts'
import {isMathFunction} from './functions.ts'
import type {BinaryOperator, Expression, MathFunctionName} from './types.ts'
import {getDynamicJSONAccess} from '../elements/data/jsonAccess.ts'

export function parseExpression(text:string,active:Base):Expression{
    const tokens = text.match(/0x[0-9a-f]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?f?|[a-z_$][\w.$]*|\*\*|,|[()[\].+\-*/%]/gi)??[]
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
        const dynamicAccess = getDynamicJSONAccess(
            token,
            active,
            expression=>parseExpression(expression,active)
        )
        if(dynamicAccess){
            while(tokens[index]==='['){
                const start = index+1
                let cursor = start
                let depth = 0
                let quote = ''
                let escaped = false
                for(;cursor<tokens.length;cursor++){
                    const part = tokens[cursor]
                    if(quote){
                        if(escaped){
                            escaped = false
                        }else if(part==='\\'){
                            escaped = true
                        }else if(part===quote){
                            quote = ''
                        }
                        continue
                    }
                    if(part==="'"||part==='"'){
                        quote = part
                    }else if(part==='['){
                        depth++
                    }else if(part===']'){
                        if(depth===0){
                            break
                        }
                        depth--
                    }
                }
                if(cursor===tokens.length){
                    throw new Error(`Unclosed index for dynamic JSON value "${token}"`)
                }
                const indexText = tokens.slice(start,cursor).join('')
                if(!indexText){
                    throw new Error('Dynamic JSON index cannot be empty')
                }
                const expanded = getDynamicJSONAccess(
                    `${token}[${indexText}]`,
                    active,
                    expression=>parseExpression(expression,active)
                )
                if(!expanded){
                    throw new Error(`Unable to resolve dynamic JSON index "${indexText}"`)
                }
                dynamicAccess.steps = expanded.steps
                index = cursor+1
                while(tokens[index]==='.'){
                    const property = tokens[index+1]
                    if(!property||!/^[a-z_$][\w$]*$/i.test(property)){
                        throw new Error('Expected a property name after dynamic JSON index')
                    }
                    dynamicAccess.steps.push({kind:'property',key:property})
                    index += 2
                }
            }
            return {kind:'jsonNumber',access:dynamicAccess,numericKind:'float'}
        }
        if(token==='true'||token==='false'){
            return {kind:'number',value:token==='true'?'1':'0',numericKind:'integer'}
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
            if(value?.isArray){
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
            if(!data.isArray&&data.type!=='number'&&data.type!=='boolean'){
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
        if(data.type!=='number'&&data.type!=='boolean'){
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
