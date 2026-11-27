import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

function assertNumber(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('while test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}



msvcrt.printf('start')

let varA:number = 0

while(varA<0){
    varA++
}
assertNumber(varA, 0)

while(varA<3){
    msvcrt.printf(' varA ')
    varA++
}

let breakCount:number = 0
while(true){
    msvcrt.printf(' true ')
    breakCount++
    break
}
assertNumber(breakCount, 1)

function cond(){
    varA += 1
    return varA<6
}

while(cond()){
    msvcrt.printf(' cond ')
}
assertNumber(varA, 6)
msvcrt.printf('while tests passed\n')
kernel.ExitProcess(0)