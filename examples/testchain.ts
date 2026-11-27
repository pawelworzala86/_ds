import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

class testClass{
    constructor(){
        console.log("testClass instance created")
    }
    testMethod(){
        console.log("testMethod called")
        return this
    }
    anotherMethod(){
        console.log("anotherMethod called")
        return this
    }
    yetAnotherMethod(){
        console.log("yetAnotherMethod called")
        return this
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

const chainedResult:testClass = instance.testMethod()
    .anotherMethod()
    .yetAnotherMethod()
assertSameInstance(chainedResult, instance)

msvcrt.printf('chain tests passed\n')
kernel.ExitProcess(0)