import * as kernel from './system/kernel.ts'
import * as gdi from './system/gdi.ts'
import * as user from './system/user.ts'
import * as opengl from './system/opengl.ts'

interface WNDCLASSEXA {
    sizeStyle: number
    lpfnWndProc: number
    extra: number
    hInstance: number
    hIcon: number
    hCursor: number
    hbrBackground: number
    lpszMenuName: number
    lpszClassName: string
    hIconSm: number
}

interface PIXELFORMATDESCRIPTOR {
    header: number
    pixels0: number
    pixels1: number
    pixels2: number
    pixels3: number
}

interface MSG {
    part0: number
    part1: number
    part2: number
    part3: number
    part4: number
    part5: number
}

.code
    jmp __ds_main

WndProc:
    sub rsp, 32
    cmp rdx, 15
    je .wm_paint
    cmp rdx, 2
    je .wm_destroy
    invoke DefWindowProcA, rcx, rdx, r8, r9
    add rsp, 32
    ret

.wm_paint:
    sub rsp, 128
    mov [rsp + 104], rcx
    mov r10, [rsp + 104]
    lea rax, [rsp + 32]
    invoke BeginPaint, r10, rax
    mov r10, [rsp + 104]
    lea rax, [rsp + 32]
    invoke EndPaint, r10, rax

    xor eax, eax
    add rsp, 128
    add rsp, 32
    ret

.wm_destroy:
    invoke PostQuitMessage, 0
    xor eax, eax
    add rsp, 32
    ret

.data
redColor dd 1.0f, 0.0f, 0.0f
greenColor dd 0.0f, 1.0f, 0.0f
blueColor dd 0.0f, 0.0f, 1.0f
topVertex dd 0.0f, 0.7f, 0.0f
leftVertex dd -0.7f, -0.7f, 0.0f
rightVertex dd 0.7f, -0.7f, 0.0f
.code

__ds_main:
// Pola obiektów TS zajmują 8 bajtów; krótsze pola WinAPI są spakowane w qwordach.
let windowClass:WNDCLASSEXA = {
    sizeStyle: 0x2300000050,
    lpfnWndProc: 0,
    extra: 0,
    hInstance: 0,
    hIcon: 0,
    hCursor: 0,
    hbrBackground: 0,
    lpszMenuName: 0,
    lpszClassName: 'MinimalClass64',
    hIconSm: 0,
}

let pixelFormat:PIXELFORMATDESCRIPTOR = {
    header: 0x2500010028,
    pixels0: 0x2000,
    pixels1: 0x1800000000000000,
    pixels2: 8,
    pixels3: 0,
}

let msg:MSG = {
    part0: 0,
    part1: 0,
    part2: 0,
    part3: 0,
    part4: 0,
    part5: 0,
}

let hInstance:number = kernel.GetModuleHandleA(0)
windowClass.lpfnWndProc = &WndProc
windowClass.hInstance = hInstance

let registeredClass:number = user.RegisterClassExA(windowClass)
if(registeredClass==0){
    kernel.ExitProcess(1)
}

let hWnd:number = user.CreateWindowExA(0, 'MinimalClass64', 'WinASM OpenGL Triangle', 0x10CF0000, 0x80000000, 0x80000000, 640, 480, 0, 0, hInstance, 0)
if(hWnd==0){
    kernel.ExitProcess(2)
}

let windowDC:number = user.GetDC(hWnd)
if(windowDC==0){
    kernel.ExitProcess(3)
}

let pixelFormatIndex:number = gdi.ChoosePixelFormat(windowDC, pixelFormat)
if(pixelFormatIndex==0){
    kernel.ExitProcess(4)
}

let pixelFormatSet:number = gdi.SetPixelFormat(windowDC, pixelFormatIndex, pixelFormat)
if(pixelFormatSet==0){
    kernel.ExitProcess(5)
}

let glContext:number = opengl.wglCreateContext(windowDC)
if(glContext==0){
    kernel.ExitProcess(6)
}

let glContextSet:number = opengl.wglMakeCurrent(windowDC, glContext)
if(glContextSet==0){
    kernel.ExitProcess(7)
}

let redColorAddress:number = &redColor
let greenColorAddress:number = &greenColor
let blueColorAddress:number = &blueColor
let topVertexAddress:number = &topVertex
let leftVertexAddress:number = &leftVertex
let rightVertexAddress:number = &rightVertex

function renderTriangle(){
    let contextSet:number = opengl.wglMakeCurrent(windowDC, glContext)
    if(contextSet==0){
        kernel.ExitProcess(9)
    }

    opengl.glClear(0x4000)
    opengl.glBegin(4)
    opengl.glColor3fv(redColorAddress)
    opengl.glVertex3fv(topVertexAddress)
    opengl.glColor3fv(greenColorAddress)
    opengl.glVertex3fv(leftVertexAddress)
    opengl.glColor3fv(blueColorAddress)
    opengl.glVertex3fv(rightVertexAddress)
    opengl.glEnd()

    let buffersSwapped:number = gdi.SwapBuffers(windowDC)
    if(buffersSwapped==0){
        kernel.ExitProcess(10)
    }
}

user.ShowWindow(hWnd, 1)
user.UpdateWindow(hWnd)
renderTriangle()

let messageResult:number = 1
while(true){
    messageResult = user.GetMessageA(msg, 0, 0, 0)
    if(messageResult==0){
        break
    }
    if(messageResult==0xFFFFFFFF){
        kernel.ExitProcess(8)
    }
    user.TranslateMessage(msg)
    user.DispatchMessageA(msg)
    if(msg.part1==15){
        renderTriangle()
    }
}

kernel.ExitProcess(0)
