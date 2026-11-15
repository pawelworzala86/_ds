import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import FuncElement from './funcElement.ts'
import DataElement from './dataElement.ts'
import FunctionArgument from './functionArgument.ts'
import TypePrototypeRegistry, {type PrototypeMethod} from './typePrototype.ts'

let arrayPushId = 0

export class Call extends Base{
    func:FuncElement|null = null
    params:FunctionArgument[] = []
    methodInstance:DataElement|null = null
    builtinArray:DataElement|null = null
    functionVariable:DataElement|null = null
    prototypeMethod = false
    prototypeReceiver = false
    arrayPushId:number|null = null
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        const name = tokenizer.get()
        if(tokenizer.get()!=='('){
            throw new Error(`Expected '(' after function "${name}"`)
        }
        const method = Call.getMethod(this,name)
        const prototype = Call.getPrototypeMethod(this,name)
        const variable = this.getData(name)
        this.func = method?.func??(prototype?.method.kind==='function'?prototype.method.func:null)??this.getFunction(name)
        this.methodInstance = method?.instance??null
        this.functionVariable = variable && (variable.type==='Function'||variable.type==='function') ? variable : null
        this.prototypeMethod = prototype?.method.kind==='function'
        this.prototypeReceiver = this.prototypeMethod&&Boolean(prototype&&!prototype.type.startsWith('class:'))
        this.builtinArray = prototype?.method.kind==='builtin'&&prototype.method.name==='push'
            ? prototype.instance
            : null
        this.params = tokenizer.getCallArguments().map(token=>new FunctionArgument(this,token))
        if(this.prototypeReceiver&&prototype){
            this.params.unshift(new FunctionArgument(this,prototype.instance.name??''))
        }
        if(this.builtinArray){
            this.builtinArray.dynamicArray = true
            if(this.params.length!==1){
                throw new Error('Array.push expects exactly one argument')
            }
            this.validateArrayPush(this.builtinArray,this.params[0])
            this.arrayPushId = ++arrayPushId
        }
        this.prepareDynamicArrayArguments()
    }
    prepareDynamicArrayArguments(){
        if(!this.func){
            return
        }
        this.func.params.forEach((parameter,index)=>{
            if(!parameter.dynamicArray){
                return
            }
            const argument = this.params[index]
            if(!(argument?.value instanceof DataElement)||!argument.value.isArray){
                throw new Error(`Function "${this.func!.name}" requires a dynamic array for parameter "${parameter.name}"`)
            }
            if(argument.value.isParameter&&!argument.value.dynamicArray){
                throw new Error(`Cannot pass static array parameter "${argument.value.name}" as a dynamic array`)
            }
            argument.value.dynamicArray = true
        })
    }
    asm(ASM:Asm){
        for(const param of this.params){
            param.asm(ASM)
        }
        if(this.builtinArray){
            this.emitArrayPush(ASM)
            return
        }
        if(this.functionVariable){
            for(let index=0;index<this.params.length;index++){
                const param = this.params[index]
                const value = param.getCode()
                if(value===null){
                    throw new Error('Unable to resolve function pointer argument')
                }
                if(value.startsWith('addr ')){
                    ASM.addCode(`lea rax, [${value.replace(/^addr\s+/,'')}]`)
                }else if(param.value instanceof DataElement&&param.value.type==='Function'){
                    ASM.addCode(`mov rax, [${param.value.name}]`)
                }else if(param.value instanceof DataElement&&param.value.isArray){
                    if(param.value.dynamicArray){
                        ASM.addCode(`mov rax, [${param.value.name}]`)
                    }else{
                        ASM.addCode(`lea rax, [${param.value.name}]`)
                    }
                }else if(param.tempName){
                    ASM.addCode(`mov rax, [${param.tempName}]`)
                }else if(param.arrayPointerName){
                    ASM.addCode(`mov rax, [${param.arrayPointerName}]`)
                }else{
                    ASM.addCode(`mov rax, [${value}]`)
                }
                ASM.addCode('push rax')
            }
            const shadowSpace = 32+(this.params.length%2===0?8:0)
            ASM.addCode(`sub rsp, ${shadowSpace}`)
            ASM.addCode(`mov rax, [${this.functionVariable.name}]`)
            ASM.addCode('call rax')
            ASM.addCode(`add rsp, ${shadowSpace+this.params.length*8}`)
            return
        }
        const canEmitArguments = this.params.every(param=>
            param.value instanceof DataElement||param.tempName!==null||param.arrayPointerName!==null
        )
        if(canEmitArguments&&!this.methodInstance){
            for(let index=0;index<this.params.length;index++){
                const param = this.params[index]
                const expected = this.func?.params[index]
                if(expected?.dynamicArray&&param.value instanceof DataElement&&param.value.isArray){
                    ASM.addCode(param.value.isParameter
                        ? `mov rax, ${param.value.name}`
                        : `lea rax, [${param.value.name}]`)
                }else if(param.value instanceof DataElement&&param.value.isArray&&!param.arrayPointerName){
                    if(param.value.dynamicArray){
                        ASM.addCode(`mov rax, [${param.value.name}]`)
                    }else{
                        ASM.addCode(`lea rax, [${param.value.name}]`)
                    }
                }else if(param.arrayPointerName){
                    ASM.addCode(`mov rax, [${param.arrayPointerName}]`)
                }else if(param.tempName){
                    ASM.addCode(`mov rax, [${param.tempName}]`)
                }else if(param.classPropertyInstance&&param.classProperty?.type==='string'){
                    const name = param.getClassPropertyAccessName()
                    ASM.addCode(`mov rax, [${name}]`)
                }else if(param.value instanceof DataElement&&param.value.classType&&expected?.type===param.value.classType){
                    ASM.addCode(`lea rax, [${param.value.name}]`)
                }else{
                    const value = param.getCode()
                    if(value===null){
                        throw new Error('Unable to resolve function argument')
                    }
                    ASM.addCode(value.startsWith('addr ')
                        ? `lea rax, [${value.replace(/^addr\s+/,'')}]`
                        : `mov rax, [${value}]`)
                }
                ASM.addCode('push rax')
            }
            const shadowSpace = 32+(this.params.length%2===0?8:0)
            ASM.addCode(`sub rsp, ${shadowSpace}`)
            ASM.addCode(`call ${this.func!.name}`)
            ASM.addCode(`add rsp, ${shadowSpace+this.params.length*8}`)
            return
        }
        const params = this.params.map((param,index)=>{
            if(this.func?.params[index]?.dynamicArray&&param.value instanceof DataElement&&param.value.isArray){
                return param.value.isParameter?param.value.name:`addr ${param.value.name}`
            }
            return param.getCode(this.methodInstance!==null)
        }).join(', ')
        const code = this.methodInstance
            ? `invoke ${this.methodInstance.name}.${this.func!.name} ${params}`
            : `rvcall ${this.func!.name} ${params}`
        ASM.addCode(code)
    }
    validateArrayPush(array:DataElement,param:FunctionArgument){
        const elementType = param.value instanceof DataElement
            ? param.value.type
            : param.arrayElementAccess?.array.type??param.arrayPropertyAccess?.property.type
        const elementClass = param.value instanceof DataElement
            ? param.value.classType
            : param.arrayElementAccess?.array.classType
        if(array.type==='number'){
            if(elementType&&elementType!=='number'){
                throw new Error(`Array.push for "${array.name}" requires a number`)
            }
            if(param.expression?.numericKind==='float'||param.value instanceof DataElement&&param.value.numericKind==='float'||param.arrayElementAccess?.array.numericKind==='float'){
                array.numericKind = 'float'
            }
            return
        }
        if(array.type==='string'){
            const literal = typeof param.value==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(param.value)
            if(!literal&&elementType!=='string'){
                throw new Error(`Array.push for "${array.name}" requires a string`)
            }
            return
        }
        if(array.classType){
            if(elementClass!==array.classType){
                throw new Error(`Array.push for "${array.name}" requires an instance of ${array.classType}`)
            }
            return
        }
        throw new Error(`Array.push is not supported for "${array.name}"`)
    }
    emitArrayPush(ASM:Asm){
        const array = this.builtinArray!
        const param = this.params[0]
        const id = this.arrayPushId!
        const valueName = `__ds_array_push_value_${id}`
        const nextCapacityName = `__ds_array_push_capacity_${id}`
        const lengthName = `${array.name}__length`
        const capacityName = `${array.name}__capacity`
        const growLabel = `__ds_array_push_grow_${id}`
        const readyLabel = `__ds_array_push_ready_${id}`
        const errorLabel = `__ds_array_push_error_${id}`
        const dynamicParameter = array.isParameter

        ASM.addData(`${valueName} dq 0`)
        ASM.addData(`${nextCapacityName} dq 0`)
        if(array.type==='string'&&typeof param.value==='string'&&/^(['"])(?:\\.|(?!\1).)*\1$/s.test(param.value)){
            const stringLabel = `__ds_array_push_string_${id}`
            const contents = param.value.slice(1,-1)
            ASM.addData(`${stringLabel} db '${contents}',0`)
            ASM.addCode(`lea rax, [${stringLabel}]`)
        }else if(array.type==='number'&&array.numericKind==='float'&&(param.expression?.numericKind==='integer'||param.value instanceof DataElement&&param.value.numericKind==='integer')){
            if(param.tempName){
                ASM.addCode(`mov rax, [${param.tempName}]`)
            }else if(param.value instanceof DataElement){
                ASM.addCode(`mov rax, [${param.value.name}]`)
            }else{
                throw new Error('Unable to resolve numeric Array.push argument')
            }
            ASM.addCode('cvtsi2sd xmm0, rax')
            ASM.addCode(`movsd qword [${valueName}], xmm0`)
            ASM.addCode(`mov rax, [${valueName}]`)
        }else if(param.arrayElementAccess||param.arrayPropertyAccess||param.tempName){
            ASM.addCode(`mov rax, [${param.tempName}]`)
        }else if(param.value instanceof DataElement){
            if(array.type==='number'){
                ASM.addCode(`mov rax, [${param.value.name}]`)
            }else if(param.value.isParameter){
                ASM.addCode(`mov rax, ${param.value.name}`)
            }else{
                ASM.addCode(`lea rax, [${param.value.name}]`)
            }
        }else{
            throw new Error('Unable to resolve Array.push argument')
        }
        if(!(array.type==='number'&&array.numericKind==='float'&&(param.expression?.numericKind==='integer'||param.value instanceof DataElement&&param.value.numericKind==='integer'))){
            ASM.addCode(`mov [${valueName}], rax`)
        }
        if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rax, [rdx+8]')
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('cmp rax, [rdx+16]')
        }else{
            ASM.addCode(`mov rax, [${lengthName}]`)
            ASM.addCode(`cmp rax, [${capacityName}]`)
        }
        ASM.addCode(`jnb ${growLabel}`)
        ASM.addCode(`jmp ${readyLabel}`)
        ASM.addCode(`${growLabel}:`)
        if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rcx, [rdx+16]')
        }else{
            ASM.addCode(`mov rcx, [${capacityName}]`)
        }
        ASM.addCode('test rcx, rcx')
        ASM.addCode(`jnz ${growLabel}_double`)
        ASM.addCode('mov rcx, 4')
        ASM.addCode(`jmp ${growLabel}_allocate`)
        ASM.addCode(`${growLabel}_double:`)
        ASM.addCode('shl rcx, 1')
        ASM.addCode(`${growLabel}_allocate:`)
        ASM.addCode(`mov [${nextCapacityName}], rcx`)
        ASM.addCode('shl rcx, 3')
        if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rdx, [rdx]')
        }else{
            ASM.addCode(`mov rdx, [${array.name}]`)
        }
        ASM.addCode('mov r8, rcx')
        ASM.addCode('mov rcx, rdx')
        ASM.addCode('mov rdx, r8')
        ASM.addImport('msvcrt','realloc')
        ASM.addCode('sub rsp, 40')
        ASM.addCode('call [realloc]')
        ASM.addCode('add rsp, 40')
        ASM.addCode('test rax, rax')
        ASM.addCode(`jz ${errorLabel}`)
        if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov [rdx], rax')
            ASM.addCode(`mov rcx, [${nextCapacityName}]`)
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov [rdx+16], rcx')
        }else{
            ASM.addCode(`mov [${array.name}], rax`)
            ASM.addCode(`mov rcx, [${nextCapacityName}]`)
            ASM.addCode(`mov [${capacityName}], rcx`)
        }
        ASM.addCode(`${readyLabel}:`)
        if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rax, [rdx+8]')
        }else{
            ASM.addCode(`mov rax, [${lengthName}]`)
        }
        ASM.addCode('shl rax, 3')
        if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('mov rdx, [rdx]')
        }else{
            ASM.addCode(`mov rdx, [${array.name}]`)
        }
        ASM.addCode('add rdx, rax')
        ASM.addCode(`mov rcx, [${valueName}]`)
        ASM.addCode('mov [rdx], rcx')
        if(dynamicParameter){
            ASM.addCode(`mov rdx, ${array.name}`)
            ASM.addCode('inc qword [rdx+8]')
        }else{
            ASM.addCode(`inc qword [${lengthName}]`)
        }
        ASM.addCode(`jmp ${errorLabel}_done`)
        ASM.addCode(`${errorLabel}:`)
        ASM.addCode('mov ecx, 1')
        ASM.addCode('sub rsp, 40')
        ASM.addImport('kernel32','ExitProcess')
        ASM.addCode('call [ExitProcess]')
        ASM.addCode('add rsp, 40')
        ASM.addCode(`${errorLabel}_done:`)
    }
    static getMethod(active:Base,name:string):{func:FuncElement,instance:DataElement}|null{
        const separator = name.indexOf('.')
        if(separator<1||separator===name.length-1){
            return null
        }
        const instance = active.getData(name.slice(0,separator))
        if(!instance?.classType){
            return null
        }
        const classType = active.getClass(instance.classType)
        const func = classType?.getFunction(name.slice(separator+1))
        return func?{func,instance}:null
    }
    static getPrototypeMethod(active:Base,name:string):{method:PrototypeMethod,instance:DataElement,type:string}|null{
        const separator = name.lastIndexOf('.')
        if(separator<1||separator===name.length-1){
            return null
        }
        const instance = active.getData(name.slice(0,separator))
        if(!instance){
            return null
        }
        const type = instance.isArray
            ? 'array'
            : instance.classType
                ? `class:${instance.classType}`
                : instance.type??''
        const method = TypePrototypeRegistry.resolve(type,name.slice(separator+1))
        return method?{method,instance,type}:null
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(active.getFunction(token)||Call.getMethod(active,token)||Call.getPrototypeMethod(active,token)||active.getData(token)?.type==='Function'||active.getData(token)?.type==='function'){
            tokenizer.move(-1)
            const data = new Call(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Call