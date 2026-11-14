import * as msvcrt from './system/msvcrt.ts'
import * as kernel from './system/kernel.ts'

import * as inc from './inc.ts'
import * as obj from './obj1.ts'




let numA:number = 11
let numB:number = 2
let numC:number = 4

numA = numB*numC

const testObj: obj.TESTOBJ = new obj.TESTOBJ()  
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


let arrayA:number[] = [1,2,3,4,5]
msvcrt.printf(',%f ',valFC*arrayA[0])

msvcrt.printf(',%s ',testObj.propB)

msvcrt.printf(',%i ',testObj.propC[0])

let strA:string[] = ['test1','test2']
strA[0] = 'test3'
strA[0] = strA[1]
msvcrt.printf(',%s ',strA[0])

const objArray:obj.TESTOBJ[] = [new obj.TESTOBJ(),new obj.TESTOBJ()]
msvcrt.printf(',%i ',objArray[0].propA)

const objArrayA:obj.TESTOBJ[] = []
objArrayA.push(objArray[0])
msvcrt.printf(',%i ',objArrayA[0].propA)
objArrayA[0].propA = 222
msvcrt.printf(',%i ',objArray[0].propA)


//COMMENT
/*
prototype obj.TESTOBJ {
    function test(){
        msvcrt.printf(' test ')
    }
}
testObj.test()
*/


function testFN(){
    msvcrt.printf(' testFN ')
}
function callbackFN(callback:Function){
    callback(44)
}
//callbackFN(testFN)
callbackFN(testObj.show)



kernel.ExitProcess()