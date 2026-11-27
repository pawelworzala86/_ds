import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

class cKlasa{
    constructor(){
        console.log("cKlasa instance created");
    }
    sayHello(){
        console.log("Hello from cKlasa");
    }
}

function testFunction(){
    const instance = new cKlasa();
    instance.sayHello();
    return instance;
}
testFunction().sayHello()

function assertNumber(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('default argument test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

function assertString(actual:string, expected:string) {
    if (actual !== expected) {
        msvcrt.printf('default argument test failed: expected %s, received %s\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

function funcA(a:number,b:number=10,c:string='test',klasa:cKlasa=new cKlasa()){
    if (a === 5) {
        assertNumber(b, 10)
        assertString(c, 'test')
    } else if (a === 6) {
        assertNumber(b, 20)
        assertString(c, 'test')
    } else if (a === 7) {
        assertNumber(b, 30)
        assertString(c, 'custom')
    } else if (a === 8) {
        assertNumber(b, 40)
        assertString(c, 'explicit')
    }
    klasa.sayHello()
}

funcA(5)

funcA(6, 20)

funcA(7, 30, 'custom')

funcA(8, 40, 'explicit')

msvcrt.printf('default argument tests passed\n')
kernel.ExitProcess(0)