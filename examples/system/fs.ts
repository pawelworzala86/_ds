import * as kernel from './lib/kernel.ts'
import * as msvcrt from './lib/msvcrt.ts'

const GENERIC_READ:number = 0x80000000
const OPEN_EXISTING:number = 3
const FILE_ATTRIBUTE_NORMAL:number = 0x80

export function readFileSync(fileName:string){

    let handle:number = 0
    let fsize:number = 0
    let buffor:number = 0

    //lea rax, [fileName]
    //msvcrt.printf(" %s ",fileName)
    
    handle = kernel.CreateFileA(fileName, GENERIC_READ, 0, 0, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, 0)
    //mov handle, rax
    //msvcrt.printf(" h %i ",handle)

    fsize = kernel.GetFileSize(handle, 0)
    //mov fsize, rax
    //msvcrt.printf(" sz %i ",fsize)

    buffor = msvcrt.calloc(fsize + 1, 1)
    //mov buffor, rax
    kernel.ReadFile(handle, buffor, fsize, 0, 0)
    //printf('%s',buffor)
    kernel.CloseHandle(handle)

    //msvcrt.printf(" %s ", buffor)

    return buffor
}