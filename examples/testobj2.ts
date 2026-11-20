import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'




msvcrt.printf('start\n')

const objA = {
    a: 1,
    b: 2,
    c: 3
}

function testFun(obj:any){

    const keys: string[] = Object.keys(obj)

    for (const key of keys) {
        msvcrt.printf('%s\n', key)
    }

    msvcrt.printf(' %i\n ', obj['a'])

}
testFun(objA)

kernel.ExitProcess(0)