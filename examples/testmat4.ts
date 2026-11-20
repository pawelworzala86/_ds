import * as msvcrt from './system/lib/msvcrt.ts'
import * as mat4 from './system/gl/mat4.ts'

let myMatrix:number[] = mat4.create()
mat4.print(myMatrix)

let fovy:number = 45.0
let aspect:number = 1.0
let near:number = 0.01
let far:number = 1000.0

mat4.perspective(myMatrix, fovy, aspect, near, far)
mat4.print(myMatrix)

myMatrix = mat4.create()
let translation:number[] = [1.0, 2.0, 3.0]
mat4.translate(myMatrix, myMatrix, translation)
mat4.print(myMatrix)