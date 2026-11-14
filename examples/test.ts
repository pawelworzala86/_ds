import * as msvcrt from './system/msvcrt.ts'
import * as kernel from './system/kernel.ts'

import * as inc from './inc.ts'

class TESTOBJ{
    propA:number = 123
    show(pA:number){
        msvcrt.printf('%i %i ',this.propA,pA)
    }
}

let numA:number = 11
let numB:number = 0

numA = numB

const testObj: TESTOBJ = new TESTOBJ()  
testObj.show(numA)

let helloTxt:string = 'Hello World!!!'

let testVar:string = 'ttt'

msvcrt.printf(helloTxt)

function testFunc(variable:string){
    msvcrt.printf(inc.testVar)
    msvcrt.printf(variable)
}

testFunc(testVar)

kernel.ExitProcess()