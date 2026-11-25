import * as kernel from './system/lib/kernel.ts'
import * as msvcrt from './system/lib/msvcrt.ts'
import * as gl from './system/gl/gl.ts'
import * as glWindow from './system/gl/glWindow.ts'
import * as shader from './system/gl/shader.ts'
import * as mat4 from './system/gl/mat4.ts'
import * as texture from './system/gl/texture.ts'
import * as mesh from './system/gl/mesh.ts'






let widthsFnt:number[] = [7.0,49.0,0.0,49.0,49.0,49.0,49.0,    
        49.0,49.0,16.0,16.0,16.0,16.0,16.0,    
        49.0,49.0,49.0,49.0,49.0,49.0,49.0,    
        49.0,49.0,49.0,49.0,49.0,49.0,49.0,    
        49.0,49.0,49.0,49.0,16.0,21.0,26.0,    
        32.0,32.0,53.0,49.0,11.0,21.0,21.0,    
        32.0,36.0,16.0,21.0,16.0,17.0,32.0,    
        32.0,32.0,32.0,32.0,32.0,32.0,32.0,    //;1234567
        32.0,32.0,17.0,17.0,36.0,36.0,36.0,    //;89
        28.0,58.0,42.0,42.0,42.0,42.0,39.0,    //;  ABCDE
        35.0,42.0,42.0, 21.0,24.0,42.0,39.0,    //;FGH IJKL
        56.0,42.0,42.0,35.0,42.0,42.0,35.0,    //;MNOPQRS
        39.0,42.0,42.0, 55.0,42.0,42.0,39.0,    //;TUV WXYZ
        21.0,17.0,21.0,30.0,32.0,21.0,28.0,    //;      a
        32.0,28.0,32.0,32.0,21.0,32.0,32.0,    //;bcdefgh
        17.0,17.0,32.0,15.0,49.0,32.0,35.0,    //;ijklmno
        32.0,32.0,21.0,24.0,17.0,32.0,32.0,    //;pqrstuv
        46.0,32.0,32.0,28.0,30.0,12.0,30.0,    //;wxyz   
        34.0,32.0,49.0,49.0,49.0,49.0,49.0,     
        49.0,49.0,49.0,49.0,49.0,49.0,49.0,     
        49.0,49.0,49.0,49.0,49.0,49.0,49.0,     
        49.0,49.0,49.0,49.0,49.0,49.0,49.0,     
        49.0,49.0,49.0,49.0,49.0,49.0,16.0,     
        21.0,32.0,32.0,32.0,32.0,12.0,32.0,     
        21.0,48.0,17.0,32.0,36.0,0.0,48.0,     
        32.0,25.0,35.0,19.0,19.0,21.0,36.0,     
        29.0,21.0,21.0,19.0,19.0,32.0,48.0,    
        48.0,48.0,28.0,46.0,46.0,46.0,46.0,    //;   ÀÁÂÃ
        46.0,46.0,56.0,42.0,39.0,39.0,39.0,    //;ÄÅÆÇÈÉÊ
        39.0,21.0,21.0,21.0,21.0,46.0,46.0,    //;ËÌÍÎÏÐÑ
        46.0,46.0,46.0,46.0,46.0,36.0,46.0,    //;ÒÓÔÕÖ  
        46.0,46.0,46.0,46.0,46.0,35.0,32.0,     
        28.0,28.0,28.0,28.0,28.0,28.0,42.0,     
        28.0,28.0,28.0,28.0,28.0,17.0,17.0,     
        17.0,17.0,32.0,32.0,32.0,32.0,32.0,     
        32.0,32.0,35.0,32.0,32.0,32.0,32.0,     
        32.0,32.0,32.0,32.0]












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

let fontFileName:string = 'texture.jpg'
let fontTextureID:number = 0





const defualtShader:shader.Shader = new shader.Shader()
const fontShader:shader.Shader = new shader.Shader()


let meshes:mesh.Mesh[] = []




let fontMesh:mesh.Mesh

function init(){
    msvcrt.printf('OK1 ')

	defualtShader.load('defaultTex')
	fontShader.load('font')

	msvcrt.printf('OK5')



	let meshInstance:mesh.Mesh = new mesh.Mesh()
	fontMesh = new mesh.Mesh()

	meshes.push(meshInstance)




	textureID = texture.LoadTexture(textureFileName)
	fontTextureID = texture.LoadTexture(fontFileName)
	
		
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
	gl.bindTexture(gl.TEXTURE_2D, textureID)
	gl.uniform1i(uniformLocation, 0)
	

	msvcrt.printf('OK6 VAO=%i',meshes[0].VAO)

	for(const mesh of meshes){
		mesh.render()
	}


	gl.useProgram(fontShader.programID)
	uniformLocation = gl.getUniformLocation(fontShader.programID, 'diffuseTexture')
	gl.bindTexture(gl.TEXTURE_2D, fontTextureID)
	gl.uniform1i(uniformLocation, 0)

	let offsetX: number = 0.0
	let letter: number = 66
	uniformLocation = gl.getUniformLocation(fontShader.programID, 'fontIndex')
	gl.uniform1i(uniformLocation, letter)

	let sizeX: number = (widthsFnt[letter] / 64.0)*0.2
	uniformLocation = gl.getUniformLocation(fontShader.programID, 'offsetX')
	gl.uniform1f(uniformLocation, offsetX)
	offsetX += sizeX

	fontMesh.render()
}

function destroy(){
}

glWindow.main(init, render, destroy)
kernel.ExitProcess(0)