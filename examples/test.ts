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
let numB:number = 2
let numC:number = 4

numA = numB*numC

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

let valFA:number = 1.23
let valFB:number = 2.23
let valFC:number = valFA*valFB
msvcrt.printf(' %f ',valFA*valFB)

kernel.ExitProcess()