declare function printf(...args:any[]):any//msvcrt
declare function malloc(...args:any[]):any//msvcrt
declare function ExitProcess(...args:any[]):any//kernel32

let helloTxt:string = 'HelloWorld!!!'

printf(helloTxt)