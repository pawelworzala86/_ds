import * as inc from './inc.ts'

declare function printf(...args:any[]):any//msvcrt
declare function malloc(...args:any[]):any//msvcrt
declare function ExitProcess(...args:any[]):any//kernel32

let helloTxt:string = 'Hello World!!!'

let testVar:string = 'ttt'

printf(helloTxt)

function testFunc(variable:string){
    printf(inc.testVar)
    printf(variable)
}

testFunc(testVar)

ExitProcess()