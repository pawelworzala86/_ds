import * as kernel from './system/lib/kernel.ts'
import * as msvcrt from './system/lib/msvcrt.ts'
import * as gl from './system/gl/gl.ts'
import * as glWindow from './system/gl/glWindow.ts'
import * as shader from './system/gl/shader.ts'

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

let defualtShader:shader.Shader = new shader.Shader()


function CreateBuffer(posID:number,ssizeA:number,ssizeE:number,lengthA:number,array:number){
    msvcrt.printf(' CreateBuffer ')
	gl.genBuffers(1, &bufferID)

	msvcrt.printf(' bufferID=%i ', bufferID)

	gl.bindBuffer(gl.ARRAY_BUFFER, bufferID)
	//lea r10, vertices
	gl.bufferData(gl.ARRAY_BUFFER, lengthA, array, gl.STATIC_DRAW)

	gl.enableVertexAttribArray(posID)
	gl.vertexAttribPointer(posID,ssizeA,gl.DOUBLE,gl.FALSE, ssizeE, 0)
}


function init(){
    msvcrt.printf('OK1 ')


	defualtShader.load()

    /*const vertexBufforTxt:number = fs.readFileSync(vertFileName)

    msvcrt.printf(' OK2 ')
	
		vertexShader = gl.createShader(gl.VERTEX_SHADER);
		msvcrt.printf(' OKa')
	const vertexBufferLength:number = msvcrt.strlen(vertexBufforTxt)
	msvcrt.printf(' vs:%i ',vertexShader)
	//lea rax, fs.buffor
	//lea rbx, fs.fsize
    msvcrt.printf('OKb')
		gl.shaderSource(vertexShader,1, &vertexBufforTxt, &vertexBufferLength);
    msvcrt.printf('OKb')
		gl.compileShader(vertexShader);
	
		
	msvcrt.printf('OKb')
	
	const fragmentBufforTxt:number = fs.readFileSync(fragFileName)
	const fragmentBufferLength:number = msvcrt.strlen(fragmentBufforTxt)
	
		//msvcrt.printf('OK2')
	
		fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
		//lea rax, fs.buffor
	//lea rbx, fs.fsize
		gl.shaderSource(fragmentShader,1, &fragmentBufforTxt, &fragmentBufferLength);
		//msvcrt.printf('OK3')
		gl.compileShader(fragmentShader);
	
		
		
	
		msvcrt.printf('OK4')
	
	
		programID = gl.createProgram();
		gl.attachShader(programID, vertexShader);
		gl.attachShader(programID, fragmentShader);
		gl.linkProgram(programID);
	
		gl.useProgram(programID);

		gl.detachShader(programID, vertexShader);
		gl.detachShader(programID, fragmentShader);
	
		gl.deleteShader(vertexShader);
		gl.deleteShader(fragmentShader);


msvcrt.printf('useProgram=%i ', programID)
*/

		msvcrt.printf('OK5')



		//lea rbx, VAO
			gl.genVertexArrays(1, &VAO)
			msvcrt.printf('VAO %i', VAO)
			gl.bindVertexArray(VAO)
		
		
		
    //let bufferID1:number = 0
    //let bufferID2:number = 0
			//lea rax, vertices
			CreateBuffer(0,3,24,144,&vertices)
			//function CreateBuffer(posID:number,ssizeA:number,ssizeE:number,lengthA:number,array:number){
				//lea rbx, bufferID1
				/*gl.genBuffers(1, &bufferID1)

				msvcrt.printf(' b=%i ', bufferID1)
			
				gl.bindBuffer(gl.ARRAY_BUFFER, bufferID1)
				//lea rax, vertices
				gl.bufferData(gl.ARRAY_BUFFER, 144, &vertices, gl.STATIC_DRAW)
			
				gl.enableVertexAttribArray(0)
				gl.vertexAttribPointer(0,3,gl.DOUBLE,gl.FALSE, 24, 0)*/
			//}
			//msvcrt.printf(' bufferID1=%i ', bufferID1)
			//lea rax, coords
			CreateBuffer(1,2,16,96,&coords)
			//function CreateBuffer(posID:number,ssizeA:number,ssizeE:number,lengthA:number,array:number){
				//lea rbx, bufferID2
				/*gl.genBuffers(1, &bufferID2)
			
				gl.bindBuffer(gl.ARRAY_BUFFER, bufferID2)
				//lea rax, coords
				gl.bufferData(gl.ARRAY_BUFFER, 96, coords, gl.STATIC_DRAW)
			
				gl.enableVertexAttribArray(1)
				gl.vertexAttribPointer(1,2,gl.DOUBLE,gl.FALSE, 16, 0)
			}*/
		
		
			//CreateBuffer(posID,ssizeA,ssizeE,lengthA,array)
		
			/*lea rbx, bufferID
			gl.genBuffers(1, rbx)
		
			gl.bindBuffer(gl.ARRAY_BUFFER, bufferID)
			gl.bufferData(gl.ARRAY_BUFFER, 144, addr vertices, gl.STATIC_DRAW)
		
			gl.enableVertexAttribArray(0)
			gl.vertexAttribPointer(0,3,gl.DOUBLE,gl.FALSE, 24, 0)*/
		
		
		
			//;textureID = texture.loadTexture(textureFileName)
		
		
			//gl.enable(gl.DEPTH_TEST)
			gl.depthFunc(gl.LEQUAL)
			gl.enable(gl.TEXTURE_2D)
		
		
		
			gl.bindVertexArray(0)

			msvcrt.printf('OK6')
}

function render(){
    gl.viewport(0, 0, 640, 480)

    msvcrt.printf('render ')
    gl.clear(gl.COLOR_BUFFER_BIT)


    gl.useProgram(defualtShader.programID);
    msvcrt.printf('useProgram=%i ', defualtShader.programID)


    let uniformLocation:number = 0

	msvcrt.printf('procADDR=%i ', gl.getUniformLocation)

	uniformLocation = gl.getUniformLocation(defualtShader.programID, 'dprojection')
	//lea rax, projection
    msvcrt.printf('uniformLocation=%i ', uniformLocation)
	gl.uniformMatrix4dv(uniformLocation, 1, 0, perspective)

	uniformLocation = gl.getUniformLocation(defualtShader.programID, 'dcamera')
	//lea rax, camera
	gl.uniformMatrix4dv(uniformLocation, 1, 0, camera)

	uniformLocation = gl.getUniformLocation(defualtShader.programID, 'dmodel')
	//lea rax, model
	gl.uniformMatrix4dv(uniformLocation, 1, 0, model)

	
	//uniformLocation = glt.getUniformLocation(programID, 'diffuseTexture')
	//glt.uniform1d(uniformLocation, textureID)
	



	gl.bindVertexArray(VAO)
	gl.drawArrays(gl.TRIANGLES, 0, 6)
}

function destroy(){
}

glWindow.main(init, render, destroy)
kernel.ExitProcess(0)