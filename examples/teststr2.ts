import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

msvcrt.printf('start\n')



let str: string = 'Hello, World!'

let strings:string[] = str.split(' ')

for(let i = 0; i < strings.length; i++) {
    msvcrt.printf('%s\n', strings[i])
}

kernel.ExitProcess(0)