import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

function assertNumber(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('prototype test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

function assertString(actual:string, expected:string) {
    if (actual !== expected) {
        msvcrt.printf('prototype test failed: expected %s, received %s\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

let shownNumber:number = 0
let shownText:string = ''
let firstNumber:number = 0

prototype number {
    function show(value:number){
        shownNumber = value
        msvcrt.printf('%i',value)
    }
}

prototype string {
    function show(value:string){
        shownText = value
        msvcrt.printf('%s',value)
    }
}

prototype array {
    function first(values:number[]){
        firstNumber = values[0]
        msvcrt.printf('%i',values[0])
    }
}

function addMore(items:number[]){
    items.push(6)
    items.push(7)
    items.push(8)
    items.push(9)
}

let numbers:number[] = []
numbers.push(1)
numbers.push(2)
numbers.push(3)
numbers.push(4)
numbers.push(5)
msvcrt.printf(',%i',numbers[4])
addMore(numbers)
msvcrt.printf(',%i',numbers[8])

let floats:number[] = []
floats.push(2.5)
floats.push(3)
msvcrt.printf(',%f %f',floats[0],floats[1])

let strings:string[] = ['before']
strings.push('after')
msvcrt.printf(',%s',strings[1])
let phrase:string = 'prototype'
phrase.show()
assertString(shownText, 'prototype')

let value:number = 7
value.show()
assertNumber(shownNumber, 7)
numbers.first()
assertNumber(firstNumber, 1)

msvcrt.printf('\nprototype tests passed\n')
kernel.ExitProcess()
