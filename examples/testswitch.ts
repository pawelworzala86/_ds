import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

function assertNumber(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('switch test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

let number:number = 2
let numberResult:number = 0
switch(number){
    case 1:
        msvcrt.printf('one\n')
        numberResult = 1
        break
    case 2:
        msvcrt.printf('two\n')
        numberResult = 2
        break
    default:
        msvcrt.printf('other number\n')
        numberResult = 3
}
assertNumber(numberResult, 2)

let text:string = 'compiler'
let textResult:number = 0
switch(text){
    case 'runtime':
        msvcrt.printf('wrong text\n')
        textResult = 1
        break
    case 'compiler':
        msvcrt.printf('string case\n')
        textResult = 2
        break
    default:
        msvcrt.printf('other text\n')
        textResult = 3
}
assertNumber(textResult, 2)

number = 9
numberResult = 0
switch(number){
    case 1:
        numberResult = 1
        break
    case 2:
        numberResult = 2
        break
    default:
        numberResult = 3
}
assertNumber(numberResult, 3)

text = 'unknown'
textResult = 0
switch(text){
    case 'runtime':
        textResult = 1
        break
    case 'compiler':
        textResult = 2
        break
    default:
        textResult = 3
}
assertNumber(textResult, 3)

msvcrt.printf('switch tests passed\n')
kernel.ExitProcess(0)