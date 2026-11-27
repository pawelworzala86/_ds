import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

let numA:number = 0
let numB:number = 0
let numC:number = 0

function assertNumber(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('async test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

class PromiseValue {
    value:number
    constructor(value:number) {
        this.value = value
    }
}

let promiseAllIndex:number = 0

function assertPromiseAllValue(value:PromiseValue) {
    if (promiseAllIndex === 0) {
        assertNumber(value.value, 10)
    } else {
        assertNumber(value.value, 20)
    }
    promiseAllIndex++
}

async function setNumA(value:number) {
    numA = value
}

async function setNumBFromNumA() {
    numB = numA + 1
}

msvcrt.printf('async tests start\n')

const firstTask:Task = setNumA(10)
await firstTask
assertNumber(numA, 10)

const secondTask:Task = setNumBFromNumA()
await secondTask
assertNumber(numB, 11)

const timerId:Task = setTimeout(() => {
    numC++
}, 5000)
clearTimeout(timerId)
assertNumber(numC, 0)

const slowPromise:Promise<PromiseValue> = new Promise((resolve,reject) => {
    setTimeout(() => {
        resolve(new PromiseValue(10))
    }, 100)
})
const fastPromise:Promise<PromiseValue> = new Promise((resolve,reject) => {
    setTimeout(() => {
        resolve(new PromiseValue(20))
    }, 10)
})
const orderedPromise:Promise<PromiseValue[]> = Promise.all([slowPromise,fastPromise])
orderedPromise.then(values => {
    values.forEach(assertPromiseAllValue)
})
assertNumber(promiseAllIndex, 2)

msvcrt.printf('async tests passed\n')
kernel.ExitProcess(0)
