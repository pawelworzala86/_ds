//import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

console.log('start\n')



let str: string = 'Hello, World! World!'

str = str.replace('Hello', 'Hi')
str = str.replace(/World/g, 'there')
console.log(str)

let firstOnly: string = 'cat cat'
firstOnly = firstOnly.replace(/cat/, 'dog')
console.log(firstOnly)

kernel.ExitProcess(0)