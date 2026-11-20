import * as kernel from './lib/kernel.ts'
import * as msvcrt from './lib/msvcrt.ts'

const GENERIC_READ:number = 0x80000000
const OPEN_EXISTING:number = 3
const FILE_ATTRIBUTE_NORMAL:number = 0x80

export class File{
    handle:number = 0
    fsize:number = 0
    //offset:number = 0
    open(fileName:string){
        msvcrt.printf('Opening file %s\n', fileName)
        this.handle = kernel.CreateFileA(fileName, GENERIC_READ, 0, 0, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0)
        this.fsize = kernel.GetFileSize(this.handle, 0)
        msvcrt.printf('this.fsize %i', this.fsize)
        //this.offset = 0
    }
    readFileBuffer(size:number){
        msvcrt.printf('Reading file buffer of size %i\n', size)
        let buffor:number = 0
        let bytesRead:number = 0

        buffor = msvcrt.malloc(size)
        kernel.ReadFile(this.handle, buffor, size, &bytesRead, 0)

        //this.offset += size

        msvcrt.printf('buffor %i, bytes read %i ', buffor, bytesRead)

        return buffor
    }
    close(){
        kernel.CloseHandle(this.handle)
    }
}