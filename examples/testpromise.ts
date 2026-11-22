import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

function showValue(value:number){
    msvcrt.printf(' resolved=%i ', value)
}

function showError(reason:number){
    msvcrt.printf(' rejected=%i ', reason)
}

function showText(value:string){
    msvcrt.printf(' text=%s ', value)
}

function showFlag(value:boolean){
    msvcrt.printf(' flag=%i ', value)
}

const resolved:Promise<number> = Promise.resolve(42)
resolved.then(showValue)
resolved.catch(showError)

const rejected:Promise<number> = Promise.reject(7)
rejected.then(showValue)
rejected.catch(showError)

const executorResolved:Promise<number> = new Promise((resolve,reject) => {
    resolve(15)
})
executorResolved.then(showValue)

const text:Promise<string> = Promise.resolve('ready')
text.then(showText)

const flag:Promise<boolean> = Promise.resolve(true)
flag.then(showFlag)



class MyClass {
    value:number
    constructor(value:number){
        this.value = value
    }
}

const executorRes:Promise<number> = new Promise((resolve,reject) => {
    resolve(15)
})
let executorResValue:number = await executorRes
console.log('executorResValue:',executorResValue)




kernel.ExitProcess(0)