declare function printf(...args:any[]):any//msvcrt
declare function malloc(...args:any[]):any//msvcrt
declare function ExitProcess(...args:any[]):any//kernel32

let helloTxt:string = 'Hello World!!!'
let format:string = 'msg %s %i %i %i'
let msgA:string = 'a'
let valA:number = 1
let formatA:string = 'msg %i'
let ptr:any = 0

printf(format, msgA, valA, 5, 8)

EndoFunc(helloTxt)

ptr = malloc(16)
ptr[0] = 11
ptr[1] = 12
printf(formatA, ptr[1])

ExitProcess()

function EndoFunc(hello:any){
    printf(hello)
}