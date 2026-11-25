import * as msvcrt from './../lib/msvcrt.ts'
import * as gl from './gl.ts'
import * as fs from './../fs.ts'

const SHADERS_DIR:string = 'shaders/'

export class Shader{
    vertexShader:number = 0
    fragmentShader:number = 0
    programID:number = 0
    load(name:string){
        const vertexBufforTxt:string = fs.readFileSync(SHADERS_DIR + name + '.vert').toString()
        
            msvcrt.printf(' OK2 ')
            
                this.vertexShader = gl.createShader(gl.VERTEX_SHADER);
                msvcrt.printf(' OKa')
            const vertexBufferLength:number = msvcrt.strlen(vertexBufforTxt)
            msvcrt.printf(' vs:%i ',this.vertexShader)
            //lea rax, fs.buffor
            //lea rbx, fs.fsize
            msvcrt.printf('OKb')
                gl.shaderSource(this.vertexShader,1, &vertexBufforTxt, &vertexBufferLength);
            msvcrt.printf('OKb')
                gl.compileShader(this.vertexShader);
            
                
            msvcrt.printf('OKb')
            
            const fragmentBufforTxt:string = fs.readFileSync(SHADERS_DIR + name + '.frag').toString()
            const fragmentBufferLength:number = msvcrt.strlen(fragmentBufforTxt)
            
                //msvcrt.printf('OK2')
            
                this.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
                //lea rax, fs.buffor
            //lea rbx, fs.fsize
                gl.shaderSource(this.fragmentShader,1, &fragmentBufforTxt, &fragmentBufferLength);
                //msvcrt.printf('OK3')
                gl.compileShader(this.fragmentShader);
            
                
                
            
                msvcrt.printf('OK4')
            
            
                this.programID = gl.createProgram();
                gl.attachShader(this.programID, this.vertexShader);
                gl.attachShader(this.programID, this.fragmentShader);
                gl.linkProgram(this.programID);
            
                gl.useProgram(this.programID);
        
                gl.detachShader(this.programID, this.vertexShader);
                gl.detachShader(this.programID, this.fragmentShader);
            
                gl.deleteShader(this.vertexShader);
                gl.deleteShader(this.fragmentShader);
    }
}