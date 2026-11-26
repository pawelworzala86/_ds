import * as gl from './../gl.ts'
import * as shader from './../shader.ts'
import * as texture from './../texture.ts'

let vertices:number[] = [1.0,1.0,0.0,1.0,-1.0,0.0,-1.0,-1.0,0.0,1.0,1.0,0.0,-1.0,-1.0,0.0,-1.0,1.0,0.0]
let coords:number[] = [1.0,1.0,1.0,0.0,0.0,0.0,1.0,1.0,0.0,0.0,0.0,1.0]

export class BoxElement {
    VAO:number = 0
    bufferID:number = 0
    shader:shader.Shader = new shader.Shader()
    fontFileName:string = 'font.png'
    fontTextureID:number = 0
    constructor(){
        this.shader.load('box')
        console.log('fontShader instance created')
        //this.fontMesh = new mesh.Mesh(this.shader)
        console.log('fontShader loaded')
        this.fontTextureID = texture.LoadTexture(this.fontFileName)
        console.log('fontTextureID loaded')

        gl.genVertexArrays(1, &this.VAO)
        //msvcrt.printf('VAO %i', this.VAO)
        gl.bindVertexArray(this.VAO)

        //msvcrt.printf(' CreateBuffer ')
        gl.genBuffers(1, &this.bufferID)
        //msvcrt.printf(' bufferID=%i ', this.bufferID)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferID)
        gl.bufferData(gl.ARRAY_BUFFER, 144, &vertices, gl.STATIC_DRAW)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0,3,gl.DOUBLE,gl.FALSE, 24, 0)

        //msvcrt.printf(' CreateBuffer ')
        gl.genBuffers(1, &this.bufferID)
        //msvcrt.printf(' bufferID=%i ', this.bufferID)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferID)
        gl.bufferData(gl.ARRAY_BUFFER, 96, &coords, gl.STATIC_DRAW)
        gl.enableVertexAttribArray(1)
        gl.vertexAttribPointer(1,2,gl.DOUBLE,gl.FALSE, 16, 0)
    }
    render(perspective:number[], camera:number[], model:number[], textureID:number){
        console.log(' fontTextureID=', this.fontTextureID,' ')
        gl.useProgram(this.shader.programID)

        let uniformLocation:number = gl.getUniformLocation(this.shader.programID, 'diffuseTexture')
        gl.uniform1i(uniformLocation, 0)
        gl.bindTexture(gl.TEXTURE_2D, this.fontTextureID)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        //let textToDisplay: string = 'jHello Worldj'

        let pixelX: number = 1.0/640.0
        let pixelY: number = 1.0/480.0

        let width: number = 32
        let height: number = 32

        let scaleX: number = width * pixelX
        let scaleY: number = height * pixelY

        let offsetX: number = -1.0 + scaleX
        let topMargin: number = 0.2
        let offsetY: number = 1.0 - topMargin - scaleY

        //for(let index=0; index<textToDisplay.length; index++){
            //let letter: number = textToDisplay.charCodeAt(index)
            //console.log('letter=', letter)
            //uniformLocation = gl.getUniformLocation(this.shader.programID, 'fontIndex')
            //gl.uniform1i(uniformLocation, letter)

            //uniformLocation = gl.getUniformLocation(this.shader.programID, 'scale')
            //gl.uniform1d(uniformLocation, scale)

            uniformLocation = gl.getUniformLocation(this.shader.programID, 'scaleX')
            gl.uniform1d(uniformLocation, scaleX)
            uniformLocation = gl.getUniformLocation(this.shader.programID, 'scaleY')
            gl.uniform1d(uniformLocation, scaleY)

            uniformLocation = gl.getUniformLocation(this.shader.programID, 'offsetY')
            gl.uniform1d(uniformLocation, offsetY)

            //let sizeX: number = (widthsFnt[letter] / 64.0)*(scaleX*2)
            uniformLocation = gl.getUniformLocation(this.shader.programID, 'offsetX')
            gl.uniform1d(uniformLocation, offsetX)
            //console.log('letter=', letter, ' offsetX=', offsetX, ' uniformLocation=', uniformLocation, letter)
            ///offsetX += sizeX

            //this.fontMesh.render(perspective, camera, model, this.fontTextureID)
            gl.bindVertexArray(this.VAO)
            gl.drawArrays(gl.TRIANGLES, 0, 6)
        //}
    }
}

export default BoxElement