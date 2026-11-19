import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

prototype number {
    function show(value:number){
        msvcrt.printf('%i',value)
    }
}

prototype string {
    function show(value:string){
        msvcrt.printf('%s',value)
    }
}

prototype array {
    function first(values:number[]){
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

let value:number = 7
value.show()
numbers.first()

kernel.ExitProcess()
