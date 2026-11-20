import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'




msvcrt.printf('start\n')

const obj = {
    a: 1,
    b: 2,
    c: 3
}

const keys: string[] = Object.keys(obj)

for (const key of keys) {
    msvcrt.printf('%s\n', key)
}

msvcrt.printf(' %i\n ', obj['a'])



kernel.ExitProcess(0)