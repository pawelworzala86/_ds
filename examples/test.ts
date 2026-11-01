let helloTxt:string = 'Hello World!!!'
let format:string = 'msg %s %i %i %i'
let msgA:string = 'a'
let valA:number = 1
let formatA:string = 'msg %i'
let ptr:number = 0

invoke printf, addr format, addr msgA, [valA], 5, 8

rvcall EndoFunc, addr helloTxt

invoke malloc, 16
mov [ptr], rax
mov [ptr+0], 11
mov [ptr+8], 12
mov [ptr], rax
invoke printf, addr formatA, [ptr+8]

invoke ExitProcess

proc EndoFunc hello
    invoke printf, hello
endp