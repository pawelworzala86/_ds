import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

msvcrt.printf('start\n')

let count = 42
let ratio = 3.5
let message:string = 'world'
console.log('test', count, ratio, message, true, false)
console.log()
const logNumbers:number[] = [1, 2.5]
const logStrings:string[] = ['hello', 'world']
const logFlags:boolean[] = [true, false]
console.log(logNumbers, logStrings, logFlags)
const logObject = { value: 42 }
console.log(logObject)
const logJson:any = JSON.parse('{"profile":{"enabled":true,"label":"admin"},"values":[1,2],"words":["a","b"],"mixed":[1,"two",false]}')
console.log(logJson)


kernel.ExitProcess(0)