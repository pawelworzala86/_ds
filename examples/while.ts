import * as msvcrt from './system/msvcrt.ts'
import * as kernel from './system/kernel.ts'




msvcrt.printf('start')

let varA:number = 0

while(varA<3){
    msvcrt.printf(' varA ')
    varA++
}

while(true){
    msvcrt.printf(' true ')
    break
}

function cond(){
    varA += 1
    return varA<6
}

while(cond()){
    msvcrt.printf(' cond ')
}