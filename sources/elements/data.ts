import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from './../asm.ts'
import DataElement from './dataElement.ts'
import Assign from './assign.ts'
import ClassElement from './clasElement.ts'
import Call from './call.ts'
import {emitDataAsm} from './data/asm.ts'
import {initializeData} from './data/initialize.ts'
import type {PromiseInitializer} from './promise.ts'

export class Data extends Base{
    element:DataElement|null = null
    initializerCall:Call|null = null
    initializerCalls:Call[] = []
    initializerTemps:DataElement[] = []
    objectAssignSources:DataElement[] = []
    runtimeInitializer:Assign|null = null
    runtimeCallInitializer = false
    arrayInitializerCall:Call|null = null
    promiseInitializer:PromiseInitializer|null = null
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer,classField=false){
        initializeData(this,tokenizer,classField)
    }
    setDestructure(tokens:string[]){
        const close = tokens.indexOf('}')
        const equals = tokens.indexOf('=')
        const sourceName = tokens[equals+1]
        if(close<2||equals!==close+1||!sourceName||equals!==tokens.length-2){
            throw new Error('Invalid struct destructuring declaration')
        }
        const source = this.parent?.getData(sourceName)
        const classType = source?.classType?this.parent?.getClass(source.classType):null
        if(!source||!classType||source.isArray){
            throw new Error(`Cannot destructure non-struct value "${sourceName}"`)
        }
        const names = tokens.slice(2,close).filter(token=>token!==',')
        if(!names.length||names.some(name=>!/^[a-z_$][\w$]*$/i.test(name))){
            throw new Error('Invalid property in struct destructuring declaration')
        }
        if(new Set(names).size!==names.length){
            throw new Error('Duplicate property in struct destructuring declaration')
        }
        for(const name of names){
            const property = classType.props.find(item=>item.name===name)
            if(!property){
                throw new Error(`Unknown property "${name}" in struct "${classType.name}"`)
            }
            if(property.isArray||property.classType||!['number','string','boolean'].includes(property.type??'')){
                throw new Error(`Struct destructuring does not support array or nested property "${name}"`)
            }
            const layoutProperty = source.classLayoutProps?.find(item=>item.name===name)
            const value = layoutProperty?.value??property.value??''
            const element = new DataElement(tokens[0],name,property.type??'',property.type==='number'||property.type==='boolean'?'0':value)
            this.parent?.addData(element)
            const declaration = new Data(this.parent!)
            declaration.element = element
            this.parent?.children.push(declaration)
            if(property.type==='number'||property.type==='boolean'){
                const initializer = new Assign(this.parent!)
                initializer.setExpression(element,`${sourceName}.${name}`,true)
                this.parent?.children.push(initializer)
            }
        }
    }
    setArrayDestructure(tokens:string[]){
        const equals = tokens.indexOf('=')
        const destructuring = tokens.slice(1,equals).join('')
        const sourceName = tokens.slice(equals+1).join('')
        const match = destructuring.match(/^\[([a-z_$][\w$]*(?:,[a-z_$][\w$]*)*)\]$/i)
        if(!match||! /^[a-z_$][\w$]*$/i.test(sourceName)){
            throw new Error('Invalid array destructuring declaration')
        }
        const names = match[1].split(',')
        if(new Set(names).size!==names.length){
            throw new Error('Duplicate variable in array destructuring declaration')
        }
        const source = this.parent?.getData(sourceName)
        if(!source?.isArray){
            throw new Error(`Cannot destructure non-array value "${sourceName}"`)
        }
        if(source.type!=='number'){
            throw new Error(`Array destructuring is not supported for "${source.type}[]"`)
        }
        if(source.arrayLength!==null&&names.length>source.arrayLength){
            throw new Error(`Cannot destructure ${names.length} values from array "${sourceName}" with ${source.arrayLength} elements`)
        }
        for(const [index,name] of names.entries()){
            const element = new DataElement(tokens[0],name,source.type,'0')
            element.numericKind = source.numericKind
            this.parent?.addData(element)
            const declaration = new Data(this.parent!)
            declaration.element = element
            this.parent?.children.push(declaration)
            const initializer = new Assign(this.parent!)
            initializer.setExpression(element,`${sourceName}[${index}]`,true)
            this.parent?.children.push(initializer)
        }
    }
    asm(ASM:Asm){
        emitDataAsm(this,ASM)
    }
    static test(active:Base,tokenizer:Tokenizer,classField=false){
        const token = tokenizer.get()
        const next = tokenizer.get()
        tokenizer.move(-2)
        const isClassField = classField&&next===':'
        if(['let','var','const'].includes(token)||isClassField){
            const data = new Data(active)
            data.set(tokenizer,isClassField)
            active.children.push(data)
            if(data.initializerCall){
                active.children.push(data.initializerCall)
            }
            if(data.promiseInitializer){
                active.children.push(data.promiseInitializer)
            }
            if(data.runtimeInitializer){
                active.children.push(data.runtimeInitializer)
            }
            for(const temporary of data.initializerTemps){
                const declaration = new Data(active)
                declaration.element = temporary
                active.children.push(declaration)
            }
            active.children.push(...data.initializerCalls)
            return data
        }
        return null
    }
}

export default Data