import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

function assertNumber(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('log test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

function assertString(actual:string, expected:string) {
    if (actual !== expected) {
        msvcrt.printf('log test failed: expected %s, received %s\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

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
assertNumber(logNumbers.length, 2)

const logObject = { value: 42, enabled: true }
console.log(logObject)
assertNumber(logObject.value, 42)
if (logObject.enabled !== true) {
    msvcrt.printf('log test failed: object boolean field\n')
    kernel.ExitProcess(1)
}

const logJson:any = JSON.parse('{"profile":{"enabled":true,"label":"admin"},"values":[1,2],"words":["a","b"],"mixed":[1,"two",false]}')
console.log(logJson)
assertString(logJson.profile.label, 'admin')
if (logJson.profile.enabled !== true) {
    msvcrt.printf('log test failed: nested boolean values\n')
    kernel.ExitProcess(1)
}

const nestedArrays:any = JSON.parse('[[1,2],[],[{"enabled":true},false]]')
const emptyArray:any = JSON.parse('[]')
const emptyObject:any = JSON.parse('{}')
console.log(nestedArrays, emptyArray, emptyObject)
assertNumber(nestedArrays.length, 3)
assertNumber(emptyArray.length, 0)


kernel.ExitProcess(0)