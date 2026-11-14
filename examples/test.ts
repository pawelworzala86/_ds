import * as inc from './inc.ts'

let helloTxt:string = 'Hello World!!!'

let testVar:string = 'ttt'

inc.printf(helloTxt)

function testFunc(variable:string){
    inc.printf(inc.testVar)
    inc.printf(variable)
}

testFunc(testVar)

inc.ExitProcess()