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
} else {
    msvcrt.printf('type test failed: matching instanceof\n')
    kernel.ExitProcess(1)
}

class cOtherTest {
    constructor() {}
}

const numericValue:number = 42
const numericValues:number[] = [1, 2, 3]

if(typeof numericValue !== 'number') {
    msvcrt.printf('type test failed: typeof number\n')
    kernel.ExitProcess(1)
}

if(typeof numericValues !== 'object') {
    msvcrt.printf('type test failed: typeof array\n')
    kernel.ExitProcess(1)
}

if(obj instanceof cOtherTest) {
    msvcrt.printf('type test failed: unrelated instanceof\n')
    kernel.ExitProcess(1)
}

if(typeof obj === 'string') {
    msvcrt.printf('obj is an typeof object\n');
}else{
    msvcrt.printf('obj is not a string\n');
}
if(typeof obj !== 'object') {
    msvcrt.printf('type test failed: typeof class instance\n')
    kernel.ExitProcess(1)
}

let str:string = 'test';
if(typeof str === 'string') {
    msvcrt.printf('str is an typeof string\n');
}
if(typeof str !== 'string') {
    msvcrt.printf('type test failed: typeof string\n')
    kernel.ExitProcess(1)
}

let isReady: boolean = true
let isClosed: boolean = false
let defaultFlag: boolean
let readyCopy: boolean = isReady
if(!defaultFlag) {
    msvcrt.printf('uninitialized boolean defaults to false\n')
} else {
    msvcrt.printf('type test failed: uninitialized boolean defaults to false\n')
    kernel.ExitProcess(1)
}
if(isReady && !isClosed && readyCopy) {
    msvcrt.printf('boolean variables and conditions work\n')
} else {
    msvcrt.printf('type test failed: boolean variables and conditions\n')
    kernel.ExitProcess(1)
}

isReady = false
if(typeof isReady === 'boolean' && !isReady) {
    msvcrt.printf('boolean assignment and typeof work\n')
} else {
    msvcrt.printf('type test failed: boolean assignment and typeof\n')
    kernel.ExitProcess(1)
}
console.log(isReady)

class BooleanBox {
    active: boolean = true
}
let box: BooleanBox = {active: true}
if(box.active) {
    msvcrt.printf('boolean struct properties work\n')
} else {
    msvcrt.printf('type test failed: boolean struct property read\n')
    kernel.ExitProcess(1)
}
box.active = false
if(!box.active) {
    msvcrt.printf('boolean struct property assignment works\n')
} else {
    msvcrt.printf('type test failed: boolean struct property assignment\n')
    kernel.ExitProcess(1)
}

let phrase: string = 'compiler text'
let hasText: boolean = phrase.includes('text')
if(hasText) {
    msvcrt.printf('boolean string method result works\n')
} else {
    msvcrt.printf('type test failed: boolean string method result\n')
    kernel.ExitProcess(1)
}

let flags: boolean[] = [true, false]
flags.push(true)
if(flags[0] && !flags[1] && flags[2]) {
    msvcrt.printf('boolean arrays work\n')
} else {
    msvcrt.printf('type test failed: boolean arrays\n')
    kernel.ExitProcess(1)
}

let shownBoolean:boolean = false
function showBoolean(value: boolean) {
    shownBoolean = value
    if(value) {
        msvcrt.printf('boolean parameters work\n')
    }
}
showBoolean(flags[2])
if(!shownBoolean) {
    msvcrt.printf('type test failed: boolean function parameter\n')
    kernel.ExitProcess(1)
}





msvcrt.printf('end\n')

kernel.ExitProcess(0)