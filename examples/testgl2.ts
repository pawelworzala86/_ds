import * as kernel from './system/lib/kernel.ts'
import * as msvcrt from './system/lib/msvcrt.ts'
import * as gl from './system/lib/opengl.ts'
import * as opengl from './system/opengl.ts'
import * as fs from './system/fs.ts'

import * as glt from './system/gl.ts'


let vertices:number[] = [0.8,1.0,0.0,1.0,-1.0,0.0,-1.0,-1.0,0.0,1.0,1.0,0.0,-1.0,-1.0,0.0,-1.0,1.0,0.0]
let coords:number[] = [1.0,1.0,1.0,0.0,0.0,0.0,1.0,1.0,0.0,0.0,0.0,1.0]


let perspective:number[] = [1.3737387097273113,0.0,0.0,0.0,0.0,1.3737387097273113,0.0,0.0,0.0,0.0,-1.02020202020202,-1.0,0.0,0.0,-2.0202020202020203,0.0]
let camera:number[] = [1.0,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0,-5.100090086,1.0]
let model:number[] = [1.0,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0,0.0,1.0]

let fovy:number = 45.0
let aspect:number = 1.0
let near:number = 0.01
let far:number = 1000.0

let cameraPos:number = -2.1



let VAO:number = 0
let bufferID:number = 0


let vertexShader:number = 0
let fragmentShader:number = 0

let programID:number = 0


let vertFileName:string = 'default.vert'
let fragFileName:string = 'default.frag'

let textureFileName:string = 'texture.jpg'
let textureID:number = 0

/*
function CreateBuffer(posID:number,ssizeA:number,ssizeE:number,lengthA:number,array:number){
    msvcrt.printf(' CreateBuffer ')
	glt.genBuffers(1, &bufferID)

	msvcrt.printf(' bufferID=%i ', bufferID)

	glt.bindBuffer(glt.ARRAY_BUFFER, bufferID)
	//lea r10, vertices
	glt.bufferData(glt.ARRAY_BUFFER, lengthA, array, glt.STATIC_DRAW)

	glt.enableVertexAttribArray(posID)
	glt.vertexAttribPointer(posID,ssizeA,glt.DOUBLE,glt.FALSE, ssizeE, 0)
}*/


function init(){
    msvcrt.printf('OK1 ')


    const vertexBufforTxt:number = fs.readFileSync(vertFileName)

    msvcrt.printf(' OK2 ')
	
		vertexShader = glt.createShader(glt.VERTEX_SHADER);
		msvcrt.printf(' OKa')
	const vertexBufferLength:number = msvcrt.strlen(vertexBufforTxt)
	msvcrt.printf(' vs:%i ',vertexShader)
	//lea rax, fs.buffor
	//lea rbx, fs.fsize
    msvcrt.printf('OKb')
		glt.shaderSource(vertexShader,1, &vertexBufforTxt, &vertexBufferLength);
    msvcrt.printf('OKb')
		glt.compileShader(vertexShader);
	
		
	msvcrt.printf('OKb')
	
	const fragmentBufforTxt:number = fs.readFileSync(fragFileName)
	const fragmentBufferLength:number = msvcrt.strlen(fragmentBufforTxt)
	
		//msvcrt.printf('OK2')
	
		fragmentShader = glt.createShader(glt.FRAGMENT_SHADER);
		//lea rax, fs.buffor
	//lea rbx, fs.fsize
		glt.shaderSource(fragmentShader,1, &fragmentBufforTxt, &fragmentBufferLength);
		//msvcrt.printf('OK3')
		glt.compileShader(fragmentShader);
	
		
		
	
		msvcrt.printf('OK4')
	
	
		programID = glt.createProgram();
		glt.attachShader(programID, vertexShader);
		glt.attachShader(programID, fragmentShader);
		glt.linkProgram(programID);
	
		glt.useProgram(programID);

		glt.detachShader(programID, vertexShader);
		glt.detachShader(programID, fragmentShader);
	
		glt.deleteShader(vertexShader);
		glt.deleteShader(fragmentShader);


msvcrt.printf('useProgram=%i ', programID)


		msvcrt.printf('OK5')



		//lea rbx, VAO
			glt.genVertexArrays(1, &VAO)
			msvcrt.printf('VAO %i', VAO)
			glt.bindVertexArray(VAO)
		
		
		
    let bufferID1:number = 0
    let bufferID2:number = 0
			//lea rax, vertices
			//CreateBuffer(0,3,24,144,&vertices)
			//function CreateBuffer(posID:number,ssizeA:number,ssizeE:number,lengthA:number,array:number){
				//lea rbx, bufferID1
				glt.genBuffers(1, &bufferID1)

				msvcrt.printf(' b=%i ', bufferID1)
			
				glt.bindBuffer(glt.ARRAY_BUFFER, bufferID1)
				//lea rax, vertices
				glt.bufferData(glt.ARRAY_BUFFER, 144, &vertices, glt.STATIC_DRAW)
			
				glt.enableVertexAttribArray(0)
				glt.vertexAttribPointer(0,3,glt.DOUBLE,glt.FALSE, 24, 0)
			//}
			msvcrt.printf(' bufferID1=%i ', bufferID1)
			//lea rax, coords
			//CreateBuffer(1,2,16,96,&coords)
			//function CreateBuffer(posID:number,ssizeA:number,ssizeE:number,lengthA:number,array:number){
				//lea rbx, bufferID2
				glt.genBuffers(1, &bufferID2)
			
				glt.bindBuffer(glt.ARRAY_BUFFER, bufferID2)
				//lea rax, coords
				glt.bufferData(glt.ARRAY_BUFFER, 96, coords, glt.STATIC_DRAW)
			
				glt.enableVertexAttribArray(1)
				glt.vertexAttribPointer(1,2,glt.DOUBLE,glt.FALSE, 16, 0)
			//}
		
		
			//CreateBuffer(posID,ssizeA,ssizeE,lengthA,array)
		
			/*lea rbx, bufferID
			gl.genBuffers(1, rbx)
		
			gl.bindBuffer(gl.ARRAY_BUFFER, bufferID)
			gl.bufferData(gl.ARRAY_BUFFER, 144, addr vertices, gl.STATIC_DRAW)
		
			gl.enableVertexAttribArray(0)
			gl.vertexAttribPointer(0,3,gl.DOUBLE,gl.FALSE, 24, 0)*/
		
		
		
			//;textureID = texture.loadTexture(textureFileName)
		
		
			//gl.enable(gl.DEPTH_TEST)
			glt.depthFunc(glt.LEQUAL)
			glt.enable(glt.TEXTURE_2D)
		
		
		
			glt.bindVertexArray(0)

			msvcrt.printf('OK6')
}

function render(){
    gl.glViewport(0, 0, 640, 480)

    msvcrt.printf('render ')
    glt.clear(glt.COLOR_BUFFER_BIT)


	glt.useProgram(programID);
    msvcrt.printf('useProgram=%i ', programID)


    let uniformLocation:number = 0
	
	/*uniformLocation = glt.getUniformLocation(programID, 'dprojection')
	//lea rax, projection
    msvcrt.printf('uniformLocation=%i ', uniformLocation)
	glt.uniformMatrix4dv(uniformLocation, 1, 0, perspective)

	uniformLocation = glt.getUniformLocation(programID, 'dcamera')
	//lea rax, camera
	glt.uniformMatrix4dv(uniformLocation, 1, 0, camera)

	uniformLocation = glt.getUniformLocation(programID, 'dmodel')
	//lea rax, model
	glt.uniformMatrix4dv(uniformLocation, 1, 0, model)*/

	
	//uniformLocation = glt.getUniformLocation(programID, 'diffuseTexture')
	//glt.uniform1d(uniformLocation, textureID)
	



	glt.bindVertexArray(VAO)
	glt.drawArrays(glt.TRIANGLES, 0, 6)
}

function destroy(){
}

opengl.main(init, render, destroy)
kernel.ExitProcess(0)