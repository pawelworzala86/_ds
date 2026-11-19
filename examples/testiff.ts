import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'




msvcrt.printf('start')

let varA:number = 10

if(1==1){
    msvcrt.printf(' equal ')
}else{
    msvcrt.printf(' not equal ')
}

if(1==varA){
    msvcrt.printf(' equal ')
}else{
    msvcrt.printf(' not equal ')
}


if(1==varA){
    msvcrt.printf(' equal ')
}else if(1==varA){
    msvcrt.printf(' equal ')
}else if(varA==varA){
    msvcrt.printf(' varA ')
}else {
    msvcrt.printf(' not equal ')
}

function testF(){
    return 1
}

if(1==testF()){
    msvcrt.printf(' testF ')
}else{
    msvcrt.printf(' not equal ')
}

if('a'=='a'){
    msvcrt.printf(' a ')
}else{
    msvcrt.printf(' not equal ')
}


kernel.ExitProcess()