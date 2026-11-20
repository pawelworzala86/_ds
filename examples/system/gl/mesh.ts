import * as gl from './../gl/gl.ts'
import * as msvcrt from './../lib/msvcrt.ts'
import * as file from './../file.ts'

export class Mesh {
    VAO:number = 0
    bufferID:number = 0
    constructor(){
        gl.genVertexArrays(1, &this.VAO)
        msvcrt.printf('VAO %i', this.VAO)
        gl.bindVertexArray(this.VAO)
    
    
    
    
    
    
    
        let f:file.File = new file.File()
        msvcrt.printf('Opening model file\n')
        f.open('model.bin')
    
        let verticesCountBuffer:number = f.readFileBuffer(8)
        //msvcrt.printf('verticesCount buffer %i', verticesCountBuffer)
        let verticesBuffer:number = f.readFileBuffer(18*8)
        //msvcrt.printf('vertices buffer %f', verticesBuffer[0])
    
        let coordsCountBuffer:number = f.readFileBuffer(8)
        //msvcrt.printf('coordsCount buffer %i', coordsCountBuffer)
        let coordsBuffer:number = f.readFileBuffer(12*8)
        //msvcrt.printf('coords buffer %f', coordsBuffer[0])
    
    
    
            
        
        msvcrt.printf(' CreateBuffer ')
        gl.genBuffers(1, &this.bufferID)
        msvcrt.printf(' bufferID=%i ', this.bufferID)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferID)
        gl.bufferData(gl.ARRAY_BUFFER, 144, verticesBuffer, gl.STATIC_DRAW)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0,3,gl.DOUBLE,gl.FALSE, 24, 0)

        msvcrt.printf(' CreateBuffer ')
        gl.genBuffers(1, &this.bufferID)
        msvcrt.printf(' bufferID=%i ', this.bufferID)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferID)
        gl.bufferData(gl.ARRAY_BUFFER, 96, coordsBuffer, gl.STATIC_DRAW)
        gl.enableVertexAttribArray(1)
        gl.vertexAttribPointer(1,2,gl.DOUBLE,gl.FALSE, 16, 0)
    }
    render(){
        gl.bindVertexArray(this.VAO)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
    }
}