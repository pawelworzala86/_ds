import * as kernel from './system/lib/kernel.ts'
import * as msvcrt from './system/lib/msvcrt.ts'
import * as gl from './system/gl/gl.ts'
import * as glWindow from './system/gl/glWindow.ts'
import * as shader from './system/gl/shader.ts'
import * as mat4 from './system/gl/mat4.ts'
import * as texture from './system/gl/texture.ts'
import * as mesh from './system/gl/mesh.ts'




let fovy:number = 45.0
let aspect:number = 1.0
let near:number = 0.01
let far:number = 1000.0


let perspective:number[] = mat4.create()
mat4.perspective(perspective, fovy, aspect, near, far)
let camera:number[] = mat4.create()
let translation:number[] = [0.0, 0.0, -3.0]
mat4.translate(camera, camera, translation)
let model:number[] = mat4.create()









let textureFileName:string = 'texture.jpg'
let textureID:number = 0





const defualtShader:shader.Shader = new shader.Shader()
const fontShader:shader.Shader = new shader.Shader()


let meshes:mesh.Mesh[] = []






function init(){
    msvcrt.printf('OK1 ')

	defualtShader.load('defaultTex')
	fontShader.load('font')

	msvcrt.printf('OK5')



	let meshInstance:mesh.Mesh = new mesh.Mesh()

	meshes.push(meshInstance)




	textureID = texture.LoadTexture(textureFileName)
	
		
	//gl.enable(gl.DEPTH_TEST)
	gl.depthFunc(gl.LEQUAL)
	gl.enable(gl.TEXTURE_2D)



	gl.bindVertexArray(0)

	msvcrt.printf('OK6')
}

function render(delay: number){
    gl.viewport(0, 0, 640, 480)

    msvcrt.printf('render ')
    gl.clear(gl.COLOR_BUFFER_BIT)


    gl.useProgram(defualtShader.programID);
    msvcrt.printf('useProgram=%i ', defualtShader.programID)


    let uniformLocation:number = 0

	msvcrt.printf('procADDR=%i ', gl.getUniformLocation)

	uniformLocation = gl.getUniformLocation(defualtShader.programID, 'dprojection')
    msvcrt.printf('uniformLocation=%i ', uniformLocation)
	gl.uniformMatrix4dv(uniformLocation, 1, 0, perspective)

	uniformLocation = gl.getUniformLocation(defualtShader.programID, 'dcamera')
	gl.uniformMatrix4dv(uniformLocation, 1, 0, camera)

	uniformLocation = gl.getUniformLocation(defualtShader.programID, 'dmodel')
	gl.uniformMatrix4dv(uniformLocation, 1, 0, model)

	
	uniformLocation = gl.getUniformLocation(defualtShader.programID, 'diffuseTexture')
	gl.uniform1d(uniformLocation, textureID)
	

	msvcrt.printf('OK6 VAO=%i',meshes[0].VAO)

	for(const mesh of meshes){
		mesh.render()
	}
}

function destroy(){
}

glWindow.main(init, render, destroy)
kernel.ExitProcess(0)