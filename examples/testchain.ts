import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

class testClass{
    value:number = 0
    constructor(){
        console.log("testClass instance created")
    }
    testMethod(){
        this.value++
        console.log("testMethod called")
        return this
    }
    anotherMethod(){
        this.value++
        console.log("anotherMethod called")
        return this
    }
    yetAnotherMethod(){
        this.value++
        console.log("yetAnotherMethod called")
        return this
    }
}

function assertNumber(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('chain test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

function assertSameInstance(actual:testClass, expected:testClass) {
    if (actual !== expected) {
        msvcrt.printf('chain test failed: method returned a different instance\n')
        kernel.ExitProcess(1)
    }
}

const instance = new testClass()
const afterTest = instance.testMethod()
assertSameInstance(afterTest, instance)
const afterAnother = afterTest.anotherMethod()
assertSameInstance(afterAnother, instance)
const afterYetAnother = afterAnother.yetAnotherMethod()
assertSameInstance(afterYetAnother, instance)
assertNumber(instance.value, 3)

const chainedResult:testClass = instance.testMethod()
    .anotherMethod()
    .yetAnotherMethod()
assertSameInstance(chainedResult, instance)
assertNumber(instance.value, 6)

const otherInstance = new testClass()
const otherResult = otherInstance.anotherMethod()
assertSameInstance(otherResult, otherInstance)
assertNumber(otherInstance.value, 1)
assertNumber(instance.value, 6)

msvcrt.printf('chain tests passed\n')
kernel.ExitProcess(0)