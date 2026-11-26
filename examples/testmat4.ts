import * as mat4 from './system/gl/mat4.ts'

let myMatrix:float[] = mat4.create()
console.log(myMatrix)

let fovy:number = 45.0
let aspect:number = 1.0
let near:number = 0.01
let far:number = 1000.0

mat4.perspective(myMatrix, fovy, aspect, near, far)
console.log(myMatrix)

myMatrix = mat4.create()
let translation:float[] = [1.0, 2.0, 3.0]
mat4.translate(myMatrix, myMatrix, translation)
console.log(myMatrix)