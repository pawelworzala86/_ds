declare function printf(...args:any[]):any//msvcrt
declare function malloc(...args:any[]):any//msvcrt
declare function ExitProcess(...args:any[]):any//kernel32

let helloTxt:string = 'Hello World!!!'
let format:string = 'msg %s %i %i %i'
let msgA:string = 'a'
let valA:number = 1
let formatA:string = 'msg %i'
let ptr:number = 0

printf(addr format, addr msgA, [valA], 5, 8)

EndoFunc(addr helloTxt)

ptr = malloc(16)
ptr[0] = 11
mov [ptr+8], 12
mov [ptr], rax
printf(addr formatA, [ptr+8])

ExitProcess()

function EndoFunc(hello:any){
    printf(hello)
}