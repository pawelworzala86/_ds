import * as kernel from './lib/kernel.ts'
import * as msvcrt from './lib/msvcrt.ts'
import Buffer from './buffer.ts'

const GENERIC_READ:number = 0x80000000
const GENERIC_WRITE:number = 0x40000000
const OPEN_EXISTING:number = 3
const CREATE_ALWAYS:number = 2
const FILE_ATTRIBUTE_NORMAL:number = 0x80

export function readFileSync(fileName:string){

    let handle:number = 0
    let fsize:number = 0
    let buffer:Buffer = new Buffer()

    //lea rax, [fileName]
    //msvcrt.printf(" %s ",fileName)
    
    handle = kernel.CreateFileA(fileName, GENERIC_READ, 0, 0, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0)
    //mov handle, rax
    //msvcrt.printf(" h %i ",handle)

    fsize = kernel.GetFileSize(handle, 0)
    //mov fsize, rax
    //msvcrt.printf(" sz %i ",fsize)

    buffer.buffer = msvcrt.calloc(fsize + 1, 1)
    //mov buffor, rax
    kernel.ReadFile(handle, buffer.buffer, fsize, 0, 0)
    //printf('%s',buffor)
    kernel.CloseHandle(handle)

    //msvcrt.printf(" %s ", buffor)

    return buffer
}

export function writeFileSync(fileName:string,contents:any){

    const contentSize:number = msvcrt.strlen(contents)
    let handle:number = 0
    let bytesWritten:number = 0

    handle = kernel.CreateFileA(fileName, GENERIC_WRITE, 0, 0, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, 0)
    kernel.WriteFile(handle, contents, contentSize, &bytesWritten, 0)
    kernel.CloseHandle(handle)
}