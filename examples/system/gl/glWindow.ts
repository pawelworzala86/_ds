import * as kernel from './../lib/kernel.ts'
import * as gdi from './../lib/gdi.ts'
import * as user from './../lib/user.ts'
import * as gl from './gl.ts'

const WM_DESTROY:number = 0x0002
const WM_SIZE:number = 0x0005
const WM_PAINT:number = 0x000F
const WM_QUIT:number = 0x0012
const PM_REMOVE:number = 0x0001
const FRAME_INTERVAL_MS:number = 17


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

function WndProc(hwnd: number, message: number, wParam: number, lParam: number) {
    switch(message){
        case WM_PAINT:
            let paint: number[] = [0,0,0,0,0,0,0,0,0]
            user.BeginPaint(hwnd, paint)
            user.EndPaint(hwnd, paint)
            return 0
        case WM_DESTROY:
            user.PostQuitMessage(0)
            return 0
    }
    user.DefWindowProcA(hwnd, message, wParam, lParam)
    return
}



function renderFrame(windowDC: number, glContext: number, render:Function, deltaTimeMs:number){
    let contextSet: number = gl.wglMakeCurrent(windowDC, glContext)
    if(contextSet==0){
        kernel.ExitProcess(9)
    }

    render(deltaTimeMs)

    let buffersSwapped: number = gdi.SwapBuffers(windowDC)
    if(buffersSwapped==0){
        kernel.ExitProcess(10)
    }
}

function registerWindowClass() {
    let windowClass: WNDCLASSEXA = {
        sizeStyle: 0x2300000050,
        lpfnWndProc: 0,
        extra: 0,
        hInstance: 0,
        hIcon: 0,
        hCursor: 0,
        hbrBackground: 6,
        lpszMenuName: 0,
        lpszClassName: 'MinimalClass64',
        hIconSm: 0,
    }

    windowClass.lpfnWndProc = &WndProc
    windowClass.hInstance = kernel.GetModuleHandleA(0)

    let registeredClass: number = user.RegisterClassExA(windowClass)
    if(registeredClass==0){
        kernel.ExitProcess(1)
    }
}

function configurePixelFormat(windowDC: number) {
    let pixelFormat: PIXELFORMATDESCRIPTOR = {
        header: 0x2500010028,
        pixels0: 0x2000,
        pixels1: 0x1800000000000000,
        pixels2: 8,
        pixels3: 0,
    }

    let pixelFormatIndex: number = gdi.ChoosePixelFormat(windowDC, pixelFormat)
    if(pixelFormatIndex==0){
        kernel.ExitProcess(4)
    }

    pixelFormatIndex = gdi.SetPixelFormat(windowDC, pixelFormatIndex, pixelFormat)
    if(pixelFormatIndex==0){
        kernel.ExitProcess(5)
    }
}

function messageLoop(windowDC: number, glContext: number, render:Function) {
    let msg: MSG = {
        part0: 0,
        part1: 0,
        part2: 0,
        part3: 0,
        part4: 0,
        part5: 0,
    }

    let previousFrameTime:number = kernel.GetTickCount64()
    while(true){
        let messageAvailable: number = user.PeekMessageA(msg, 0, 0, 0, PM_REMOVE)
        while(messageAvailable!=0){
            if(msg.part1==WM_QUIT){
                return
            }
            user.TranslateMessage(msg)
            user.DispatchMessageA(msg)
            messageAvailable = user.PeekMessageA(msg, 0, 0, 0, PM_REMOVE)
        }
        let currentFrameTime:number = kernel.GetTickCount64()
        let deltaTimeMs:number = currentFrameTime - previousFrameTime
        if(deltaTimeMs>=FRAME_INTERVAL_MS){
            renderFrame(windowDC, glContext, render, deltaTimeMs)
            previousFrameTime = currentFrameTime
        }else{
            kernel.Sleep(FRAME_INTERVAL_MS - deltaTimeMs)
        }
    }
}

export function main(init:Function,render:Function,destroy:Function){
    let hInstance: number = kernel.GetModuleHandleA(0)
    registerWindowClass()

    let hWnd: number = user.CreateWindowExA(0, 'MinimalClass64', 'WinASM OpenGL Triangle', 0x10CF0000, 0x80000000, 0x80000000, 640, 480, 0, 0, hInstance, 0)
    if(hWnd==0){
        kernel.ExitProcess(2)
    }

    let windowDC: number = user.GetDC(hWnd)
    if(windowDC==0){
        kernel.ExitProcess(3)
    }

    configurePixelFormat(windowDC)

    let glContext: number = gl.createContext(windowDC)
    if(glContext==0){
        kernel.ExitProcess(6)
    }

    let glContextSet: number = gl.makeCurrent(windowDC, glContext)
    if(glContextSet==0){
        kernel.ExitProcess(7)
    }

    gl.initializeGL()
    init()

    user.ShowWindow(hWnd, 1)
    user.UpdateWindow(hWnd)

    messageLoop(windowDC, glContext, render)

    destroy()
    kernel.ExitProcess(0)
}

//main()
//kernel.ExitProcess(0)