import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'



interface STR{
    testA: string
    propA: number
}

let str:STR = {
    testA: ' test ',
    propA: 123,
}

let strA = {
    testA: ' test ',
    propA: 123,
}

msvcrt.printf(' start ')

msvcrt.printf(strA.testA)

msvcrt.printf(' %i ',str.propA)

function assertNumber(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('struct test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

function assertString(actual:string, expected:string) {
    if (actual !== expected) {
        msvcrt.printf('struct test failed: expected %s, received %s\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

let {testA, propA} = strA
msvcrt.printf(' %s ',testA)
assertString(testA, ' test ')
assertNumber(propA, 123)

str.testA = ' test2 '
assertString(str.testA, ' test2 ')
assertNumber(str.propA, 123)

function testFunc(o:STR){
    msvcrt.printf(' %s ',o.testA)
    assertString(o.testA, ' test2 ')
    assertNumber(o.propA, 123)
}
testFunc(str)

kernel.ExitProcess()