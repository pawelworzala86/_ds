import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

msvcrt.printf('start\n')

for(let index=0;index<5;index++){
    msvcrt.printf('index: %i\n', index)
}

const array:number[] = [1, 2, 3, 4, 5]
for(const i in array){
    msvcrt.printf('array[%i]: %i\n', i, array[i])
}

const array2:any[] = [{test:'A'},{test:'B'}]
for(const obj in array2){
    msvcrt.printf('array2[%i]: %s\n', obj, array2[obj].test)
}

kernel.ExitProcess(0)