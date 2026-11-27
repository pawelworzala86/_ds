import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

function assertNumber(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('for test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

msvcrt.printf('start\n')

for(let index=0;index<5;index++){
    msvcrt.printf('index: %i\n', index)
}

let skippedForCount:number = 0
for(let skippedIndex=0;skippedIndex<0;skippedIndex++){
    skippedForCount++
}
assertNumber(skippedForCount, 0)

let breakForCount:number = 0
for(let breakIndex=0;breakIndex<5;breakIndex++){
    breakForCount++
    if(breakIndex===2){
        break
    }
}
assertNumber(breakForCount, 3)

const array:number[] = [1, 2, 3, 4, 5]
for(const i in array){
    msvcrt.printf('array[%i]: %i\n', i, array[i])
}

const emptyArray:number[] = []
let emptyArrayIterations:number = 0
for(const emptyIndex in emptyArray){
    emptyArrayIterations++
}
assertNumber(emptyArrayIterations, 0)

const sparseArray:number[] = []
sparseArray[0] = 10
sparseArray[2] = 30
let sparseArrayIterations:number = 0
let sparseArrayIndexTotal:number = 0
for(const sparseIndex in sparseArray){
    sparseArrayIterations++
    sparseArrayIndexTotal += sparseIndex
}
assertNumber(sparseArrayIterations, 3)
assertNumber(sparseArrayIndexTotal, 3)

const array2:any[] = [{test:'A'},{test:'B'}]
for(const obj in array2){
    msvcrt.printf('array2[%i]: %s\n', obj, array2[obj].test)
}

msvcrt.printf('for tests passed\n')
kernel.ExitProcess(0)