import * as wininet from './lib/wininet.ts'
import * as msvcrt from './lib/msvcrt.ts'
import * as kernel from './lib/kernel.ts'

const INTERNET_OPEN_TYPE_PRECONFIG:number = 0
const INTERNET_FLAG_RELOAD:number = 0x80000000
const FETCH_CHUNK_SIZE:number = 8192

class FetchResponse {
    body:number
    constructor(body:number) {
        this.body = body
    }
    text():string {
        return this.body
    }
}

export function fetch(url:string):FetchResponse {
    let session:number = wininet.InternetOpenA('ds', INTERNET_OPEN_TYPE_PRECONFIG, 0, 0, 0)
    if (session === 0) {
        msvcrt.printf('fetch failed to initialize WinINet\n')
        kernel.ExitProcess(1)
    }

    let request:number = wininet.InternetOpenUrlA(session, url, 0, 0, INTERNET_FLAG_RELOAD, 0)
    if (request === 0) {
        wininet.InternetCloseHandle(session)
        msvcrt.printf('fetch failed to open URL: %s\n', url)
        kernel.ExitProcess(1)
    }

    let body:number = msvcrt.calloc(1, 1)
    let terminator:number = msvcrt.calloc(1, 1)
    let chunk:number = msvcrt.malloc(FETCH_CHUNK_SIZE)
    let bytesRead:number = 0
    let totalBytes:number = 0
    let succeeded:number = 0
    let newBody:number = 0

    while (true) {
        bytesRead = 0
        succeeded = wininet.InternetReadFile(request, chunk, FETCH_CHUNK_SIZE, &bytesRead)
        if (succeeded === 0) {
            wininet.InternetCloseHandle(request)
            wininet.InternetCloseHandle(session)
            msvcrt.printf('fetch failed while reading URL: %s\n', url)
            kernel.ExitProcess(1)
        }
        if (bytesRead === 0) {
            break
        }

        newBody = msvcrt.realloc(body, totalBytes + bytesRead + 1)
        if (newBody === 0) {
            wininet.InternetCloseHandle(request)
            wininet.InternetCloseHandle(session)
            msvcrt.printf('fetch ran out of memory while reading URL: %s\n', url)
            kernel.ExitProcess(1)
        }
        body = newBody
        msvcrt.memcpy(body + totalBytes, chunk, bytesRead)
        totalBytes = totalBytes + bytesRead
        msvcrt.memcpy(body + totalBytes, terminator, 1)
    }

    wininet.InternetCloseHandle(request)
    wininet.InternetCloseHandle(session)
    msvcrt.free(chunk)
    msvcrt.free(terminator)

    const response:FetchResponse = new FetchResponse(body)
    return response
}

export default fetch