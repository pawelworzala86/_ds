import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

msvcrt.printf('start\n')

let count = 42
let ratio = 3.5
let message:string = 'world'
console.log('test', count, ratio, message, true, false)
console.log()


kernel.ExitProcess(0)