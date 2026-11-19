import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'




msvcrt.printf('start\n')


class cTest {
    constructor() {
        msvcrt.printf('cTest constructor\n');
    }
    show(value:number, message:string) {
        msvcrt.printf('cTest show %i %s\n',value,message);
    }
    inherited() {
        msvcrt.printf('inherited cTest method\n');
    }
}
const obj:cTest = new cTest();



class cNewTest extends cTest{
    constructor() {
        super()
    }
    show() {
        super.show(123,'from child')
    }
}
const objNew:cNewTest = new cNewTest();
objNew.show();
objNew.inherited();












kernel.ExitProcess(0)