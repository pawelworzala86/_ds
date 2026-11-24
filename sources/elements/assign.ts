import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from './../asm.ts'
import DataElement from './dataElement.ts'
import {parseExpression, type Expression} from '../maths.ts'
import {setExpression} from './assign/setExpression.ts'
import {emitAssign} from './assign/emit.ts'
import {getClassPropertyAccess, getClassPropertyOffset} from './clasElement.ts'
import FuncElement from './funcElement.ts'
import Call from './call.ts'
import Timeout from './timeout.ts'
import type Invoke from './invoke.ts'
import {getPromiseValueTypeFromData} from './promise.ts'

export class Assign extends Base{
    target:DataElement|null = null
    expression:Expression|null = null
    targetIndex:Expression|null = null
    stringValue:string|null = null
    stringAppend = false
    stringPropertyTarget = false
    stringSource:DataElement|null = null
    stringCall:Call|null = null
    stringSourceIndex:Expression|null = null
    arrayPropertyTarget:{array:DataElement,index:Expression,property:DataElement,offset:number}|null = null
    addressLabel:string|null = null
    invokeExpression:Invoke|null = null
    functionCall:Call|null = null
    arrayCall:Call|null = null
    asyncCall:Call|null = null
    promiseAwait:DataElement|null = null
    timeout:Timeout|null = null
    addressFunction:FuncElement|null = null
    constructor(parent:Base){
        super(parent)
    }
    setExpression(target:DataElement,expression:string,initializer=false,indexText?:string,append=false){
        setExpression(this,target,expression,initializer,indexText,append)
    }
    setTask(target:DataElement,expression:string){
        const tokenizer = new Tokenizer(expression)
        if(tokenizer.tokens[0]==='setTimeout'){
            const timeout = new Timeout(this.parent!)
            timeout.set(tokenizer)
            if(tokenizer.has()){
                throw new Error('Task initializer must be a single setTimeout call')
            }
            this.target = target
            this.timeout = timeout
            target.timeoutLockName = timeout.lockName
            target.timeoutCompletedName = timeout.completedName
            return
        }
        const call = new Call(this.parent!)
        call.set(tokenizer)
        if(tokenizer.has()){
            throw new Error('Task initializer must be a single async function call')
        }
        if(!call.func?.isAsync){
            throw new Error('Task initializer must call an async function')
        }
        this.target = target
        this.asyncCall = call
    }
    set(tokenizer:Tokenizer){
        const tokens:string[] = []
        let token:string
        while(!['\n',';'].includes(token = tokenizer.get())){
            tokens.push(token)
        }
        let statement = tokens.join('').replace(/;$/,'')
        const quotedProperty = statement.match(/^([a-z_$][\w$]*)\[['"]([a-z_$][\w$]*)['"]\](\*\*=|\+=|-=|\*=|\/=|%=|=)(.+?);?$/i)
        if(quotedProperty){
            statement = `${quotedProperty[1]}.${quotedProperty[2]}${quotedProperty[3]}${quotedProperty[4]}`
        }
        const postfixUpdate = statement.match(/^([a-z_$][\w.$]*)(?:\[([^\]]+)\])?(\+\+|--)$/i)
        if(postfixUpdate){
            const [,targetName,indexText,operator] = postfixUpdate
            const target = `${targetName}${indexText?`[${indexText}]`:''}`
            statement = `${target}=${target}${operator==='++'?'+':'-'}1`
        }
        const arrayProperty = statement.match(/^([a-z_$][\w$]*)\[([^\]]+)\]\.(\w+)=(.+?);?$/i)
        if(arrayProperty){
            const [,arrayName,indexText,propertyName,expression] = arrayProperty
            const array = this.parent?.getData(arrayName)
            const classType = array?.classType?this.parent?.getClass(array.classType):null
            const property = classType?.props.find(prop=>prop.name===propertyName)??null
            const offset = classType?getClassPropertyOffset(classType,propertyName,name=>this.parent!.getClass(name)):null
            if(!array?.isArray||!classType||!property||offset===null){
                throw new Error(`Unknown object-array property "${arrayName}[${indexText}].${propertyName}"`)
            }
            if(property.type!=='number'){
                throw new Error('Only numeric object-array properties can be assigned')
            }
            const index = parseExpression(indexText,this.parent!)
            if(index.numericKind!=='integer'){
                throw new Error('Array index must be an integer')
            }
            this.target = array
            this.expression = parseExpression(expression,this.parent!)
            this.arrayPropertyTarget = {array,index,property,offset}
            return
        }
        const match = statement.match(/^([a-z_$][\w.$]*)(?:\[([^\]]+)\])?(\*\*=|\+=|-=|\*=|\/=|%=|=)(.+?);?$/i)
        if(!match){
            throw new Error('Invalid assignment')
        }
        const [,targetName,indexText,operator,matchedExpression] = match
        const awaitIndex = tokens.indexOf('await')
        const expression = awaitIndex!==-1&&awaitIndex===tokens.length-2
            ? `await ${tokens[awaitIndex+1]}`
            : matchedExpression
        const access = this.parent?getClassPropertyAccess(this.parent,targetName):null
        const target = this.parent?.getData(targetName)??(access
            ? new DataElement('let',`${access.instance.name}.${access.path}`,access.property.type??'',access.property.value??'')
            : null)
        if(!target){
            throw new Error(`Unknown assignment target "${targetName}"`)
        }
        if(access){
            target.classType = access.property.classType
            target.isArray = access.property.isArray
            target.numericKind = access.property.numericKind
            target.classPropertyInstance = access.instance
            target.classPropertyPath = access.path
            if(access.instance.classType){
                const classType = this.parent?.getClass(access.instance.classType)
                target.classPropertyOffset = classType
                    ? getClassPropertyOffset(classType,targetName.split('.').slice(1).join('.'),name=>this.parent!.getClass(name))
                    : null
                if(target.classPropertyOffset===null){
                    throw new Error(`Unable to resolve local struct property "${access.path}"`)
                }
            }
        }
        const stringAppend = target.type==='string'&&operator==='+='
        if(operator!=='='&&target.type!=='number'&&!stringAppend){
            throw new Error('Compound assignment is only supported for number variables')
        }
        if(target.type==='Task'&&operator==='='){
            if(target.kind==='const'){
                throw new Error(`Cannot assign to constant "${target.name}"`)
            }
            this.setTask(target,expression)
            return
        }
        if(access?.property.type==='string'&&!access.property.isArray){
            const literal = expression.trim().match(/^(['"])(?:\\.|(?!\1).)*\1$/s)
            if(operator!=='='||!literal){
                throw new Error('Struct string properties can only be assigned a string literal')
            }
            this.target = target
            this.stringValue = literal[0]
            this.stringPropertyTarget = true
            return
        }
        const assignmentExpression = operator==='='
            ? expression
            : `${targetName}${indexText?`[${indexText}]`:''}${operator.slice(0,-1)}(${expression})`
        this.setExpression(target,stringAppend?expression:assignmentExpression,false,indexText,stringAppend)
    }
    asm(ASM:Asm){
        emitAssign(this,ASM)
    }
    static test(active:Base,tokenizer:Tokenizer){
        const first = tokenizer.get()
        const second = tokenizer.get()
        tokenizer.move(-2)
        const compactAssignment = first.match(/^([a-z_$][\w.$]*(?:\[[^\]]+\])?)(?:\*\*=|\+=|-=|\*=|\/=|%=|=)/i)
        const postfixUpdate = first.match(/^([a-z_$][\w.$]*(?:\[[^\]]+\])?)(?:\+\+|--)$/i)
        const propertyAssignment = first.match(/^([a-z_$][\w$]*\[[^\]]+\]\.[a-z_$][\w$]*)(?:\*\*=|\+=|-=|\*=|\/=|%=|=)/i)
        const statementEnd = tokenizer.tokens.findIndex((token,index)=>index>=tokenizer.index&&(token==='\n'||token===';'))
        const statement = tokenizer.tokens.slice(tokenizer.index,statementEnd===-1?undefined:statementEnd).join('')
        const quotedPropertyAssignment = statement.match(/^([a-z_$][\w$]*)\[['"]([a-z_$][\w$]*)['"]\](?:\*\*=|\+=|-=|\*=|\/=|%=|=)/i)
        const isAssignmentOperator = second==='='||['+=','-=','*=','/=','%=','**='].includes(second)
        const targetName = isAssignmentOperator?first:compactAssignment?.[1]??postfixUpdate?.[1]??propertyAssignment?.[1]??quotedPropertyAssignment?.[1]
        const dataName = targetName?.match(/^([a-z_$][\w.$]*)/i)?.[1]
        if(dataName&&(active.getData(dataName)||getClassPropertyAccess(active,dataName))){
            const data = new Assign(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        return null
    }
}

export default Assign
