import * as msvcrt from './system/msvcrt.ts'
import * as kernel from './system/kernel.ts'

import * as inc from './inc.ts'



let helloTxt:string = 'Hello World!!!'

let testVar:string = 'ttt'

msvcrt.printf(helloTxt)

function testFunc(variable:string){
    msvcrt.printf(inc.testVar)
    msvcrt.printf(variable)
}

testFunc(testVar)

kernel.ExitProcess()