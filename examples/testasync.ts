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

msvcrt.printf('async tests passed\n')
kernel.ExitProcess(0)
