import * as kernel from './system/lib/kernel.ts'
import * as gl from './system/lib/opengl.ts'
import * as opengl from './system/opengl.ts'

function init(){
}

function render(){
    let values: number[] = [1.0, 0.0, 0.0]
    gl.glViewport(0, 0, 640, 480)
    gl.glClear(0x4000)
    gl.glBegin(4)
    gl.glColor3dv(values)
    values[0] = 0.0
    values[1] = 0.7
    gl.glVertex3dv(values)

    values[0] = 0.0
    values[1] = 1.0
    gl.glColor3dv(values)
    values[0] = -0.7
    values[1] = -0.7
    gl.glVertex3dv(values)

    values[0] = 0.0
    values[1] = 0.0
    values[2] = 1.0
    gl.glColor3dv(values)
    values[0] = 0.7
    values[1] = -0.7
    values[2] = 0.0
    gl.glVertex3dv(values)
    gl.glEnd()
}

function destroy(){
}

opengl.main(init, render, destroy)
kernel.ExitProcess(0)