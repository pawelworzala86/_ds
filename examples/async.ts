import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'


let numA:number = 0
let numB:number = 0
let numC:number = 0

async function testFunc(variable:number){
    msvcrt.printf(' variable=%i ', variable)
    while(numA < 10){
        msvcrt.printf('%i ', numA)
        numA++
    }
}

msvcrt.printf(' c=%i ', numC)
testFunc(numB)
numC++
const timerId = setTimeout(() => {
    numC++
    msvcrt.printf(' t=%i ', numC)
}, 100)
clearTimeout(timerId);
msvcrt.printf(' c=%i ', numC)

//kernel.ExitProcess(0)