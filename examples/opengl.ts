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

interface GLState {
    deviceContext: number
    context: number
}

.code
    jmp __ds_main

WndProc:
    ; Callback musi zachować ABI Win64; procedury TS używają konwencji stosowej.
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
    mov [rsp + 112], rax

    mov r10, [rsp + 104]
    invoke GetWindowLongPtrA, r10, -21
    mov [rsp + 120], rax

    mov rax, [rsp + 120]
    mov r10, [rax]
    mov r11, [rax + 8]
    invoke wglMakeCurrent, r10, r11
    test eax, eax
    jz .wm_paint_done
    invoke glClear, 04000h
    invoke glBegin, 4
    invoke glColor3fv, addr redColor
    invoke glVertex3fv, addr topVertex
    invoke glColor3fv, addr greenColor
    invoke glVertex3fv, addr leftVertex
    invoke glColor3fv, addr blueColor
    invoke glVertex3fv, addr rightVertex
    invoke glEnd
    mov rax, [rsp + 120]
    mov r10, [rax]
    invoke SwapBuffers, r10
.wm_paint_done:
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

let glState:GLState = {
    deviceContext: 0,
    context: 0,
}
glState.deviceContext = windowDC
glState.context = glContext
user.SetWindowLongPtrA(hWnd, -21, glState)
user.ShowWindow(hWnd, 1)
user.UpdateWindow(hWnd)

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
}

kernel.ExitProcess(0)
