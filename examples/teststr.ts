import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

msvcrt.printf('start\n')



let str: string = 'Hello, World!'

for(let i = 0; i < str.length; i++) {
    msvcrt.printf('%c\n', str.charCodeAt(i))
}



kernel.ExitProcess(0)