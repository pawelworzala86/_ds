import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'




msvcrt.printf('start\n')


class cTest {
    constructor() {}
    show() {
        msvcrt.printf('cTest show \n');
    }
}
const obj:cTest = new cTest();
obj.show()

if(obj instanceof cTest) {
    msvcrt.printf('obj is an instance of cTest\n');
}

if(typeof obj === 'string') {
    msvcrt.printf('obj is an typeof object\n');
}else{
    msvcrt.printf('obj is not a string\n');
}

let str:string = 'test';
if(typeof str === 'string') {
    msvcrt.printf('str is an typeof string\n');
}

let isReady: boolean = true
let isClosed: boolean = false
let defaultFlag: boolean
let readyCopy: boolean = isReady
if(!defaultFlag) {
    msvcrt.printf('uninitialized boolean defaults to false\n')
}
if(isReady && !isClosed && readyCopy) {
    msvcrt.printf('boolean variables and conditions work\n')
}

isReady = false
if(typeof isReady === 'boolean' && !isReady) {
    msvcrt.printf('boolean assignment and typeof work\n')
}
console.log(isReady)

class BooleanBox {
    active: boolean = true
}
let box: BooleanBox = {active: true}
if(box.active) {
    msvcrt.printf('boolean struct properties work\n')
}
box.active = false
if(!box.active) {
    msvcrt.printf('boolean struct property assignment works\n')
}

let phrase: string = 'compiler text'
let hasText: boolean = phrase.includes('text')
if(hasText) {
    msvcrt.printf('boolean string method result works\n')
}

let flags: boolean[] = [true, false]
flags.push(true)
if(flags[0] && !flags[1] && flags[2]) {
    msvcrt.printf('boolean arrays work\n')
}

function showBoolean(value: boolean) {
    if(value) {
        msvcrt.printf('boolean parameters work\n')
    }
}
showBoolean(flags[2])





msvcrt.printf('end\n')

kernel.ExitProcess(0)