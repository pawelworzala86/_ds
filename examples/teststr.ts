import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

msvcrt.printf('start\n')



let str: string = 'Hello, World!'

for(let i = 0; i < str.length; i++) {
    msvcrt.printf('%c\n', str.charCodeAt(i))
}

let str2: string = 'Hello\n'

str = str2
str += 'test'

msvcrt.printf(' %s\n', str2)
msvcrt.printf(' %s\n', str)

kernel.ExitProcess(0)