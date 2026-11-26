import * as gl from './../gl.ts'
import * as shader from './../shader.ts'
import * as texture from './../texture.ts'
import GUIElement from './gui.ts'

let vertices:number[] = [1.0,1.0,0.0,1.0,-1.0,0.0,-1.0,-1.0,0.0,1.0,1.0,0.0,-1.0,-1.0,0.0,-1.0,1.0,0.0]
let coords:number[] = [1.0,1.0,1.0,0.0,0.0,0.0,1.0,1.0,0.0,0.0,0.0,1.0]

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


let scale: number = 0.065
let vertices2:number[] = [1.0,1.0,0.0,1.0,-1.0,0.0,-1.0,-1.0,0.0,1.0,1.0,0.0,-1.0,-1.0,0.0,-1.0,1.0,0.0]
for(let i = 0; i < vertices.length; i++){
    vertices2[i] = vertices[i] * scale
}

export class Font extends GUIElement {
    VAO:number = 0
    bufferID:number = 0
    shader:shader.Shader = new shader.Shader()
    fontFileName:string = 'font.png'
    fontTextureID:number = 0
    constructor(){
        super()
        this.shader.load('font')
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
        gl.bufferData(gl.ARRAY_BUFFER, 144, &vertices2, gl.STATIC_DRAW)
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
        //console.log(' fontTextureID=', this.fontTextureID,' ')
        gl.useProgram(this.shader.programID)

        let uniformLocation:number = gl.getUniformLocation(this.shader.programID, 'diffuseTexture')
        gl.uniform1i(uniformLocation, 0)
        gl.bindTexture(gl.TEXTURE_2D, this.fontTextureID)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        let textToDisplay: string = 'jHello Worldj'

        let scaleX: number = scale
        let scaleY: number = scale
        let offsetX: number = -1.0 + scaleX
        //console.log('scaleY=', scaleY)
        let topMargin: number = 0.2
        let offsetY: number = 1.0 - topMargin - scaleY

        for(let index=0; index<textToDisplay.length; index++){
            let letter: number = textToDisplay.charCodeAt(index)
            //console.log('letter=', letter)
            uniformLocation = gl.getUniformLocation(this.shader.programID, 'fontIndex')
            gl.uniform1i(uniformLocation, letter)

            //uniformLocation = gl.getUniformLocation(this.shader.programID, 'scale')
            //gl.uniform1d(uniformLocation, scale)

            uniformLocation = gl.getUniformLocation(this.shader.programID, 'offsetY')
            gl.uniform1d(uniformLocation, offsetY)

            let sizeX: number = (widthsFnt[letter] / 64.0)*(scaleX*2)
            uniformLocation = gl.getUniformLocation(this.shader.programID, 'offsetX')
            gl.uniform1d(uniformLocation, offsetX)
            //console.log('letter=', letter, ' offsetX=', offsetX, ' uniformLocation=', uniformLocation, letter)
            offsetX += sizeX

            //this.fontMesh.render(perspective, camera, model, this.fontTextureID)
            gl.bindVertexArray(this.VAO)
            gl.drawArrays(gl.TRIANGLES, 0, 6)
        }
    }
}

export default Font