import * as ws2_32 from './lib/ws2_32.ts'
import * as msvcrt from './lib/msvcrt.ts'
import * as kernel from './lib/kernel.ts'

const AF_INET:number = 2
const SOCK_STREAM:number = 1
const IPPROTO_TCP:number = 6
const SOMAXCONN:number = 128
const SOCKET_ADDRESS_SIZE:number = 16
const REQUEST_BUFFER_SIZE:number = 8192
const WSA_DATA_SIZE:number = 512
const METHOD_GET:number = 1
const METHOD_POST:number = 2
const METHOD_PUT:number = 3
const METHOD_PATCH:number = 4
const METHOD_DELETE:number = 5

function getRequestMethod(raw:number):number {
    let prefix:number = 0
    let suffix:number = 0
    let finalByte:number = 0

    msvcrt.memcpy(&prefix, raw, 4)
    if (prefix === 0x20544547) {
        return METHOD_GET
    }
    if (prefix === 0x54534f50) {
        msvcrt.memcpy(&suffix, raw + 4, 1)
        if (suffix === 32) {
            return METHOD_POST
        }
    }
    if (prefix === 0x20545550) {
        return METHOD_PUT
    }
    if (prefix === 0x43544150) {
        msvcrt.memcpy(&suffix, raw + 4, 2)
        if (suffix === 0x2048) {
            return METHOD_PATCH
        }
    }
    if (prefix === 0x454c4544) {
        msvcrt.memcpy(&suffix, raw + 4, 2)
        msvcrt.memcpy(&finalByte, raw + 6, 1)
        if (suffix === 0x4554 && finalByte === 32) {
            return METHOD_DELETE
        }
    }
    return 0
}

function sendAll(clientSocket:number, buffer:number, size:number) {
    let sentBytes:number = 0
    let totalSent:number = 0

    if (size === 0) {
        return
    }

    while (totalSent < size) {
        sentBytes = ws2_32.send(clientSocket, buffer + totalSent, size - totalSent, 0)
        if (sentBytes <= 0) {
            msvcrt.printf('http failed to send the complete response\n')
            kernel.ExitProcess(1)
        }
        totalSent = totalSent + sentBytes
    }
}

function sendJsonResponse(clientSocket:number, statusCode:number, headerName:number, headerValue:number, body:string) {
    const bodyLength:number = msvcrt.strlen(body)
    const headerNameLength:number = msvcrt.strlen(headerName)
    const headerValueLength:number = msvcrt.strlen(headerValue)
    const statusPrefixLength:number = msvcrt.strlen('HTTP/1.1 ')
    const statusTextLength:number = msvcrt.strlen(' OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ')
    const lineBreakLength:number = msvcrt.strlen('\r\n')
    const connectionTextLength:number = msvcrt.strlen('Connection: close\r\n\r\n')
    const headerSeparatorLength:number = msvcrt.strlen(': ')
    let statusBuffer:number = msvcrt.calloc(16, 1)
    let lengthBuffer:number = msvcrt.calloc(16, 1)
    let statusLength:number = 0
    let lengthTextLength:number = 0
    let headersCapacity:number = 0
    let headers:number = 0
    let headersLength:number = 0

    if (statusBuffer === 0 || lengthBuffer === 0) {
        msvcrt.printf('http ran out of memory while preparing a JSON response\n')
        kernel.ExitProcess(1)
    }

    msvcrt._itoa(statusCode, statusBuffer, 10)
    msvcrt._itoa(bodyLength, lengthBuffer, 10)
    statusLength = msvcrt.strlen(statusBuffer)
    lengthTextLength = msvcrt.strlen(lengthBuffer)
    headersCapacity = statusPrefixLength + statusLength + statusTextLength + lengthTextLength + lineBreakLength + connectionTextLength + 1
    if (headerNameLength > 0) {
        headersCapacity = headersCapacity + headerNameLength + headerSeparatorLength + headerValueLength + lineBreakLength
    }
    headers = msvcrt.calloc(headersCapacity, 1)
    if (headers === 0) {
        msvcrt.printf('http ran out of memory while preparing a JSON response\n')
        kernel.ExitProcess(1)
    }

    msvcrt.strcpy(headers, 'HTTP/1.1 ')
    msvcrt.strcat(headers, statusBuffer)
    msvcrt.strcat(headers, ' OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ')
    msvcrt.strcat(headers, lengthBuffer)
    msvcrt.strcat(headers, '\r\n')
    if (headerNameLength > 0) {
        msvcrt.strcat(headers, headerName)
        msvcrt.strcat(headers, ': ')
        msvcrt.strcat(headers, headerValue)
        msvcrt.strcat(headers, '\r\n')
    }
    msvcrt.strcat(headers, 'Connection: close\r\n\r\n')
    headersLength = msvcrt.strlen(headers)
    sendAll(clientSocket, headers, headersLength)
    sendAll(clientSocket, body, bodyLength)

    msvcrt.free(headers)
    msvcrt.free(statusBuffer)
    msvcrt.free(lengthBuffer)
}

function invokeCallback(callback:Function) {
    callback()
}

export class Request {
    raw:number
    method:string

    constructor(raw:number) {
        this.raw = raw
        this.method = ''
        const methodCode:number = getRequestMethod(raw)
        if (methodCode === METHOD_GET) {
            this.method = 'GET'
        } else if (methodCode === METHOD_POST) {
            this.method = 'POST'
        } else if (methodCode === METHOD_PUT) {
            this.method = 'PUT'
        } else if (methodCode === METHOD_PATCH) {
            this.method = 'PATCH'
        } else if (methodCode === METHOD_DELETE) {
            this.method = 'DELETE'
        }
    }

    isGet():boolean {
        if (getRequestMethod(this.raw) === METHOD_GET) {
            return true
        } else {
            return false
        }
    }

    isPost():boolean {
        if (getRequestMethod(this.raw) === METHOD_POST) {
            return true
        } else {
            return false
        }
    }

    isPut():boolean {
        if (getRequestMethod(this.raw) === METHOD_PUT) {
            return true
        } else {
            return false
        }
    }

    isPatch():boolean {
        if (getRequestMethod(this.raw) === METHOD_PATCH) {
            return true
        } else {
            return false
        }
    }

    isDelete():boolean {
        if (getRequestMethod(this.raw) === METHOD_DELETE) {
            return true
        } else {
            return false
        }
    }
}

export class Response {
    clientSocket:number
    statusCode:number = 200
    contentType:number
    headerName:number
    headerValue:number

    constructor(clientSocket:number) {
        const defaultContentTypeLength:number = msvcrt.strlen('text/plain; charset=utf-8')
        this.clientSocket = clientSocket
        this.contentType = msvcrt.calloc(defaultContentTypeLength + 1, 1)
        this.headerName = msvcrt.calloc(1, 1)
        this.headerValue = msvcrt.calloc(1, 1)
        msvcrt.strcpy(this.contentType, 'text/plain; charset=utf-8')
    }

    setHeader(name:string, value:string) {
        let valueLength:number = 0
        if (name === 'Content-Type') {
            valueLength = msvcrt.strlen(value)
            this.contentType = msvcrt.realloc(this.contentType, valueLength + 1)
            if (this.contentType === 0) {
                msvcrt.printf('http ran out of memory while setting a response header\n')
                kernel.ExitProcess(1)
            }
            msvcrt.strcpy(this.contentType, value)
        } else {
            valueLength = msvcrt.strlen(name)
            this.headerName = msvcrt.realloc(this.headerName, valueLength + 1)
            valueLength = msvcrt.strlen(value)
            this.headerValue = msvcrt.realloc(this.headerValue, valueLength + 1)
            if (this.headerName === 0 || this.headerValue === 0) {
                msvcrt.printf('http ran out of memory while setting a response header\n')
                kernel.ExitProcess(1)
            }
            msvcrt.strcpy(this.headerName, name)
            msvcrt.strcpy(this.headerValue, value)
        }
    }

    json(body:any) {
        sendJsonResponse(this.clientSocket, this.statusCode, this.headerName, this.headerValue, body)
        msvcrt.free(this.contentType)
        msvcrt.free(this.headerName)
        msvcrt.free(this.headerValue)
    }

    end(body:string) {
        const bodyLength:number = msvcrt.strlen(body)
        const headerNameLength:number = msvcrt.strlen(this.headerName)
        const statusPrefixLength:number = msvcrt.strlen('HTTP/1.1 ')
        const statusTextLength:number = msvcrt.strlen(' OK\r\nContent-Type: ')
        const contentLengthTextLength:number = msvcrt.strlen('\r\nContent-Length: ')
        const lineBreakLength:number = msvcrt.strlen('\r\n')
        const connectionTextLength:number = msvcrt.strlen('Connection: close\r\n\r\n')
        const headerSeparatorLength:number = msvcrt.strlen(': ')
        const contentTypeLength:number = msvcrt.strlen(this.contentType)
        const headerValueLength:number = msvcrt.strlen(this.headerValue)
        let statusLength:number = 0
        let lengthTextLength:number = 0
        let headersLength:number = 0
        let headersCapacity:number = 0
        let bodyBuffer:number = msvcrt.malloc(bodyLength + 1)
        let statusBuffer:number = msvcrt.calloc(16, 1)
        let lengthBuffer:number = msvcrt.calloc(16, 1)
        let headers:number = 0

        if (bodyBuffer === 0 || statusBuffer === 0 || lengthBuffer === 0) {
            msvcrt.printf('http ran out of memory while preparing a response\n')
            kernel.ExitProcess(1)
        }

        msvcrt._itoa(this.statusCode, statusBuffer, 10)
        msvcrt._itoa(bodyLength, lengthBuffer, 10)
        statusLength = msvcrt.strlen(statusBuffer)
        lengthTextLength = msvcrt.strlen(lengthBuffer)

        headersCapacity = statusPrefixLength + statusLength + statusTextLength + contentTypeLength + contentLengthTextLength + lengthTextLength + lineBreakLength + connectionTextLength + 1
        if (headerNameLength > 0) {
            headersCapacity = headersCapacity + headerNameLength + headerSeparatorLength + headerValueLength + lineBreakLength
        }
        headers = msvcrt.calloc(headersCapacity, 1)
        if (headers === 0) {
            msvcrt.printf('http ran out of memory while preparing a response\n')
            kernel.ExitProcess(1)
        }

        msvcrt.memcpy(bodyBuffer, body, bodyLength)
        msvcrt.strcpy(headers, 'HTTP/1.1 ')
        msvcrt.strcat(headers, statusBuffer)
        msvcrt.strcat(headers, ' OK\r\nContent-Type: ')
        msvcrt.strcat(headers, this.contentType)
        msvcrt.strcat(headers, '\r\nContent-Length: ')
        msvcrt.strcat(headers, lengthBuffer)
        msvcrt.strcat(headers, '\r\n')
        if (headerNameLength > 0) {
            msvcrt.strcat(headers, this.headerName)
            msvcrt.strcat(headers, ': ')
            msvcrt.strcat(headers, this.headerValue)
            msvcrt.strcat(headers, '\r\n')
        }
        msvcrt.strcat(headers, 'Connection: close\r\n\r\n')

        headersLength = msvcrt.strlen(headers)
        sendAll(this.clientSocket, headers, headersLength)
        sendAll(this.clientSocket, bodyBuffer, bodyLength)

        msvcrt.free(bodyBuffer)
        msvcrt.free(headers)
        msvcrt.free(statusBuffer)
        msvcrt.free(lengthBuffer)
        msvcrt.free(this.contentType)
        msvcrt.free(this.headerName)
        msvcrt.free(this.headerValue)
    }
}

function dispatchRequest(requestListener:Function, requestBuffer:number, clientSocket:number) {
    msvcrt.printf('trace: dispatch start\n')
    msvcrt.fflush(0)
    const request:Request = new Request(requestBuffer)
    const response:Response = new Response(clientSocket)
    msvcrt.printf('trace: response ready\n')
    msvcrt.fflush(0)
    requestListener(request, response)
    msvcrt.printf('trace: listener returned\n')
    msvcrt.fflush(0)
}

export class Server {
    requestListener:Function
    listeningSocket:number = 0

    constructor() {
    }

    listen(port:number, hostname:string, callback:Function) {
        let wsaData:number = msvcrt.calloc(1, WSA_DATA_SIZE)
        let socketAddress:number = msvcrt.calloc(1, SOCKET_ADDRESS_SIZE)
        let family:number = AF_INET
        let networkPort:number = 0
        let address:number = 0
        let startupResult:number = 0
        let bindResult:number = 0
        let listenResult:number = 0
        let requestListener:Function

        if (wsaData === 0 || socketAddress === 0) {
            msvcrt.printf('http ran out of memory while creating a server\n')
            kernel.ExitProcess(1)
        }

        startupResult = ws2_32.WSAStartup(0x0202, wsaData)
        if (startupResult !== 0) {
            msvcrt.printf('http failed to initialize Winsock\n')
            msvcrt.fflush(0)
            kernel.ExitProcess(1)
        }

        networkPort = ws2_32.htons(port)
        address = ws2_32.inet_addr(hostname)

        this.listeningSocket = ws2_32.socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)
        if (this.listeningSocket === -1) {
            msvcrt.printf('http failed to create a listening socket\n')
            msvcrt.fflush(0)
            kernel.ExitProcess(1)
        }

        if (address === -1) {
            msvcrt.printf('http received an invalid hostname\n')
            msvcrt.fflush(0)
            kernel.ExitProcess(1)
        }

        msvcrt.memcpy(socketAddress, &family, 2)
        msvcrt.memcpy(socketAddress + 2, &networkPort, 2)
        msvcrt.memcpy(socketAddress + 4, &address, 4)

        bindResult = ws2_32.bind(this.listeningSocket, socketAddress, SOCKET_ADDRESS_SIZE)
        if (bindResult !== 0) {
            msvcrt.printf('http failed to bind to the requested address and port\n')
            msvcrt.fflush(0)
            kernel.ExitProcess(1)
        }

        listenResult = ws2_32.listen(this.listeningSocket, SOMAXCONN)
        if (listenResult !== 0) {
            msvcrt.printf('http failed to listen on the requested port\n')
            msvcrt.fflush(0)
            kernel.ExitProcess(1)
        }

        invokeCallback(callback)
        msvcrt.fflush(0)
        requestListener = this.requestListener

        while (true) {
            let clientSocket:number = ws2_32.accept(this.listeningSocket, 0, 0)
            if (clientSocket < 0) {
                msvcrt.printf('http failed to accept a client connection\n')
                msvcrt.fflush(0)
                ws2_32.closesocket(this.listeningSocket)
                ws2_32.WSACleanup()
                msvcrt.free(socketAddress)
                msvcrt.free(wsaData)
                return
            }

            let requestBuffer:number = msvcrt.calloc(REQUEST_BUFFER_SIZE, 1)
            let bytesReceived:number = 0
            if (requestBuffer === 0) {
                ws2_32.closesocket(clientSocket)
                msvcrt.printf('http ran out of memory while receiving a request\n')
                kernel.ExitProcess(1)
            }

            bytesReceived = ws2_32.recv(clientSocket, requestBuffer, REQUEST_BUFFER_SIZE - 1, 0)
            if (bytesReceived > 0) {
                dispatchRequest(requestListener, requestBuffer, clientSocket)
            } else if (bytesReceived < 0) {
                msvcrt.printf('http failed while receiving a request\n')
                msvcrt.fflush(0)
            }

            ws2_32.closesocket(clientSocket)
            msvcrt.free(requestBuffer)
        }

        ws2_32.closesocket(this.listeningSocket)
        ws2_32.WSACleanup()
        msvcrt.free(socketAddress)
        msvcrt.free(wsaData)
    }
}

function setRequestListener(server:Server, requestListener:Function) {
    server.requestListener = requestListener
}

export class Http {
    createServer(requestListener:Function):Server {
        const server:Server = new Server()
        setRequestListener(server, requestListener)
        return server
    }
}

const http:Http = new Http()
export default http
