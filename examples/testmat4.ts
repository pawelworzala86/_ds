import * as mat4 from './system/gl/mat4.ts'
import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

function assertNear(actual:number, expected:number, label:string) {
    const tolerance:number = 0.0001
    if (actual < expected - tolerance || actual > expected + tolerance) {
        msvcrt.printf('mat4 test failed: %s expected %f, received %f\n', label, expected, actual)
        kernel.ExitProcess(1)
    }
}

function assertMatrix(actual:float[], expected:float[], label:string) {
    for (let i = 0; i < 16; i++) {
        assertNear(actual[i], expected[i], label)
    }
}

let myMatrix:float[] = mat4.create()
const identity:float[] = [
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0
]
assertMatrix(myMatrix, identity, 'create')
console.log(myMatrix)

let fovy:number = 45.0
let aspect:number = 1.0
let near:number = 0.01
let far:number = 1000.0

mat4.perspective(myMatrix, fovy, aspect, near, far)
const perspective:float[] = [
    1.792591, 0.0, 0.0, 0.0,
    0.0, 1.792591, 0.0, 0.0,
    0.0, 0.0, -1.00002, -1.0,
    0.0, 0.0, -0.0200002, 0.0
]
assertMatrix(myMatrix, perspective, 'perspective')
console.log(myMatrix)

myMatrix = mat4.create()
let translation:float[] = [1.0, 2.0, 3.0]
mat4.translate(myMatrix, myMatrix, translation)
const translated:float[] = [
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    1.0, 2.0, 3.0, 1.0
]
assertMatrix(myMatrix, translated, 'translate')
console.log(myMatrix)

msvcrt.printf('mat4 tests passed\n')
kernel.ExitProcess(0)