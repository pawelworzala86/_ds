import * as msvcrt from './system/msvcrt.ts'
import * as kernel from './system/kernel.ts'



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

let {testA} = strA
msvcrt.printf(' %s ',testA)

str.testA = ' test2 '
function testFunc(o:STR){
    msvcrt.printf(' %s ',o.testA)
}
testFunc(str)

kernel.ExitProcess()