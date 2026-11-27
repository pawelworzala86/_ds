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

function assertBranch(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('if test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

let branchResult:number = 0

if (1==varA) {
    branchResult = 1
} else if (varA==varA) {
    branchResult = 2
} else if (3==varA) {
    branchResult = 3
} else {
    branchResult = 4
}
assertBranch(branchResult, 2)

if (1==varA) {
    branchResult = 1
} else if (2==varA) {
    branchResult = 2
} else if (varA==varA) {
    branchResult = 3
} else {
    branchResult = 4
}
assertBranch(branchResult, 3)

if (1==varA) {
    branchResult = 1
} else if (2==varA) {
    branchResult = 2
} else if (3==varA) {
    branchResult = 3
} else {
    branchResult = 4
}
assertBranch(branchResult, 4)

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