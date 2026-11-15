import * as kernel from './system/kernel.ts'
import * as gdi from './system/gdi.ts'
import * as user from './system/user.ts'
import * as opengl from './system/opengl.ts'

.code
    invoke GetModuleHandleA, 0
    mov [hInstance], rax

    lea rax, [WndProc]
    mov [WindowClass.lpfnWndProc], rax
    mov rax, [hInstance]
    mov [WindowClass.hInstance], rax
    lea rax, [_className]
    mov [WindowClass.lpszClassName], rax
    invoke RegisterClassExA, addr WindowClass
    test eax, eax
    jz exit

    sub rsp, 8
    call CreateMainWindow
    add rsp, 8
    test rax, rax
    jz exit
    mov [hWnd], rax

    invoke GetDC, [hWnd]
    test rax, rax
    jz exit
    mov [windowDC], rax

    invoke ChoosePixelFormat, [windowDC], addr PixelFormat
    test eax, eax
    jz exit
    mov [pixelFormatIndex], rax

    invoke SetPixelFormat, [windowDC], [pixelFormatIndex], addr PixelFormat
    test eax, eax
    jz exit

    invoke wglCreateContext, [windowDC]
    test rax, rax
    jz exit
    mov [glContext], rax

    invoke wglMakeCurrent, [windowDC], [glContext]
    test eax, eax
    jz exit

    invoke ShowWindow, [hWnd], 1
    invoke UpdateWindow, [hWnd]

msg_loop:
    invoke GetMessageA, addr msg, 0, 0, 0
    test eax, eax
    jz exit
    cmp eax, -1
    je exit
    invoke TranslateMessage, addr msg
    invoke DispatchMessageA, addr msg
    jmp msg_loop

exit:
    invoke ExitProcess, 0

proc CreateMainWindow
    ; CreateWindowExA ma 12 argumentów i wymaga ręcznego ułożenia stosu.
    sub rsp, 96
    xor ecx, ecx
    lea rdx, [_className]
    lea r8, [_windowName]
    mov r9, 010CF0000h

    mov rax, 080000000h
    mov [rsp + 32], rax
    mov [rsp + 40], rax
    mov qword [rsp + 48], 640
    mov qword [rsp + 56], 480
    mov qword [rsp + 64], 0
    mov qword [rsp + 72], 0
    mov rax, [hInstance]
    mov [rsp + 80], rax
    mov qword [rsp + 88], 0

    call [CreateWindowExA]
    add rsp, 96
endp

proc WndProc
    local savedHwnd dq
    local savedMessage dq
    local savedWParam dq
    local savedLParam dq
    ; Dodatkowe 8 bajtów utrzymuje wyrównanie stosu przy wywołaniach API.
    local alignment dq

    mov [savedHwnd], rcx
    mov [savedMessage], rdx
    mov [savedWParam], r8
    mov [savedLParam], r9

    cmp qword [savedMessage], 15
    je .wm_paint
    cmp qword [savedMessage], 2
    je .wm_destroy

    invoke DefWindowProcA, [savedHwnd], [savedMessage], [savedWParam], [savedLParam]
    jmp .done

.wm_paint:
    invoke BeginPaint, [savedHwnd], addr paintStruct
    invoke wglMakeCurrent, [windowDC], [glContext]
    invoke glClear, 04000h
    invoke glBegin, 4
    invoke glColor3fv, addr redColor
    invoke glVertex3fv, addr topVertex
    invoke glColor3fv, addr greenColor
    invoke glVertex3fv, addr leftVertex
    invoke glColor3fv, addr blueColor
    invoke glVertex3fv, addr rightVertex
    invoke glEnd
    invoke SwapBuffers, [windowDC]
    invoke EndPaint, [savedHwnd], addr paintStruct
    xor eax, eax
    jmp .done

.wm_destroy:
    invoke PostQuitMessage, 0
    xor eax, eax

.done:
endp

.data
struct WNDCLASSEXA
    cbSizeStyle dd 80, 0x23
    lpfnWndProc dq 0
    extra dd 0, 0
    hInstance dq 0
    handles dq 0, 0, 0
    lpszMenuName dq 0
    lpszClassName dq 0
    hIconSm dq 0
end struct

struct PIXELFORMATDESCRIPTOR
    header dw 40, 1
    flags dd 0x25
    pixelFormat db 0, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24, 8, 0, 0, 0
    layerMasks dd 0, 0, 0
end struct

struct MSG
    hwnd dq 0
    messageAndPadding dd 0, 0
    parameters dq 0, 0
    timeAndPoint dd 0, 0, 0
    private dd 0
end struct

WindowClass WNDCLASSEXA
PixelFormat PIXELFORMATDESCRIPTOR
msg MSG
paintStruct dq 0,0,0,0,0,0,0,0,0

hInstance dq 0
hWnd dq 0
windowDC dq 0
glContext dq 0
pixelFormatIndex dq 0

_className db 77,105,110,105,109,97,108,67,108,97,115,115,54,52,0
_windowName db 87,105,110,65,83,77,32,79,112,101,110,71,76,32,84,114,105,97,110,103,108,101,0

redColor dd 1.0f,0.0f,0.0f
greenColor dd 0.0f,1.0f,0.0f
blueColor dd 0.0f,0.0f,1.0f
topVertex dd 0.0f,0.7f,0.0f
leftVertex dd -0.7f,-0.7f,0.0f
rightVertex dd 0.7f,-0.7f,0.0f
