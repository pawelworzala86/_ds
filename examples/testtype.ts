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






msvcrt.printf('end\n')

kernel.ExitProcess(0)