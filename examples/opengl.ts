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

function WndProc(hwnd: number, message: number, wParam: number, lParam: number) {
    if(message==15){
        let paint: number[] = [0,0,0,0,0,0,0,0,0]
        user.BeginPaint(hwnd, paint)
        user.EndPaint(hwnd, paint)
        return 0
    }
    if(message==2){
        user.PostQuitMessage(0)
        return 0
    }
    user.DefWindowProcA(hwnd, message, wParam, lParam)
    return
}

function renderTriangle(windowDC: number, glContext: number) {
    let contextSet: number = opengl.wglMakeCurrent(windowDC, glContext)
    if(contextSet==0){
        kernel.ExitProcess(9)
    }

    let values: number[] = [1.0, 0.0, 0.0]
    opengl.glViewport(0, 0, 640, 480)
    opengl.glClear(0x4000)
    opengl.glBegin(4)
    opengl.glColor3dv(values)
    values[0] = 0.0
    values[1] = 0.7
    opengl.glVertex3dv(values)

    values[0] = 0.0
    values[1] = 1.0
    opengl.glColor3dv(values)
    values[0] = -0.7
    values[1] = -0.7
    opengl.glVertex3dv(values)

    values[0] = 0.0
    values[1] = 0.0
    values[2] = 1.0
    opengl.glColor3dv(values)
    values[0] = 0.7
    values[1] = -0.7
    values[2] = 0.0
    opengl.glVertex3dv(values)
    opengl.glEnd()

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

function messageLoop(windowDC: number, glContext: number) {
    let msg: MSG = {
        part0: 0,
        part1: 0,
        part2: 0,
        part3: 0,
        part4: 0,
        part5: 0,
    }

    let messageResult: number = 1
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
            renderTriangle(windowDC, glContext)
        }
    }
}

function main() {
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

    let glContext: number = opengl.wglCreateContext(windowDC)
    if(glContext==0){
        kernel.ExitProcess(6)
    }

    let glContextSet: number = opengl.wglMakeCurrent(windowDC, glContext)
    if(glContextSet==0){
        kernel.ExitProcess(7)
    }

    user.ShowWindow(hWnd, 1)
    user.UpdateWindow(hWnd)
    renderTriangle(windowDC, glContext)

    messageLoop(windowDC, glContext)

    kernel.ExitProcess(0)
}

main()
kernel.ExitProcess(0)