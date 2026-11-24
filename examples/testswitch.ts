import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

let number:number = 2
switch(number){
    case 1:
        msvcrt.printf('one\n')
        break
    case 2:
        msvcrt.printf('two\n')
        break
    default:
        msvcrt.printf('other number\n')
}

let text:string = 'compiler'
switch(text){
    case 'runtime':
        msvcrt.printf('wrong text\n')
        break
    case 'compiler':
        msvcrt.printf('string case\n')
        break
    default:
        msvcrt.printf('other text\n')
}

kernel.ExitProcess(0)