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

function assertNumber(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('promise test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

let promiseAllCatchCount:number = 0

function showUnexpectedAll(values:number[]) {
    msvcrt.printf('promise test failed: Promise.all unexpectedly resolved\n')
    kernel.ExitProcess(1)
}

function showAllError(reason:number[]) {
    promiseAllCatchCount++
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

/*function showClass(value:MyClass){
    console.log('promise class callback:',value.value)
}*/

const executorRes:Promise<MyClass> = new Promise((resolve,reject) => {
    setTimeout(() => {
        resolve(new MyClass(44))
    }, 1000)
})
//executorRes.then(showClass)
let executorResValue:MyClass = await executorRes
console.log('executorResValue:',executorResValue.value)





const promise1:Promise<MyClass> = new Promise((resolve,reject) => {
    setTimeout(() => {
        resolve(new MyClass(44))
    }, 1000)
})
const promise2:Promise<MyClass> = new Promise((resolve,reject) => {
    setTimeout(() => {
        resolve(new MyClass(44))
    }, 1000)
})
const allPromises:Promise<MyClass[]> = Promise.all([promise1,promise2])
allPromises.then(values => {
    values.forEach(value => {
        console.log('allPromises value:', value.value)
    })
})

const resolvedNumber:Promise<number> = Promise.resolve(21)
const rejectedAll:Promise<number[]> = Promise.all([resolvedNumber,rejected])
rejectedAll.then(showUnexpectedAll)
rejectedAll.catch(showAllError)
assertNumber(promiseAllCatchCount, 1)



kernel.ExitProcess(0)