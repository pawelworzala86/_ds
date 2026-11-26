import * as gl from './gl.ts'
import * as shader from './shader.ts'
import * as mesh from './mesh.ts'
import * as texture from './texture.ts'

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

export class Font {
    fontShader:shader.Shader = new shader.Shader()
    fontFileName:string = 'font.png'
    fontTextureID:number = 0
    fontMesh:mesh.Mesh
    constructor(){
        this.fontShader.load('font')
        console.log('fontShader instance created')
        this.fontMesh = new mesh.Mesh(this.fontShader)
        console.log('fontShader loaded')
        this.fontTextureID = texture.LoadTexture(this.fontFileName)
        console.log('fontTextureID loaded')
    }
    render(perspective:number[], camera:number[], model:number[], textureID:number){
        console.log(' fontTextureID=', this.fontTextureID,' ')
        gl.useProgram(this.fontShader.programID)
            let uniformLocation:number = gl.getUniformLocation(this.fontShader.programID, 'diffuseTexture')
        gl.uniform1i(uniformLocation, 0)
        gl.bindTexture(gl.TEXTURE_2D, this.fontTextureID)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        let textToDisplay: string = 'Hello World'
        let offsetX: number = 0.0

        for(let index=0; index<textToDisplay.length; index++){
            let letter: number = textToDisplay.charCodeAt(index)
            //console.log('letter=', letter)
            uniformLocation = gl.getUniformLocation(this.fontShader.programID, 'fontIndex')
            gl.uniform1i(uniformLocation, letter)

            let sizeX: number = (widthsFnt[letter] / 64.0)*0.2
            uniformLocation = gl.getUniformLocation(this.fontShader.programID, 'offsetX')
            gl.uniform1d(uniformLocation, offsetX)
            console.log('letter=', letter, ' offsetX=', offsetX, ' uniformLocation=', uniformLocation, letter)
            offsetX += sizeX

            this.fontMesh.render(perspective, camera, model, this.fontTextureID)
        }
    }
}

export default Font