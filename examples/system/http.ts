import * as ws2_32 from './lib/ws2_32.ts'
import * as msvcrt from './lib/msvcrt.ts'
import * as kernel from './lib/kernel.ts'

type DynamicJSON = any
type StaticJSON = any

const AF_INET:number = 2
const SOCK_STREAM:number = 1
const IPPROTO_TCP:number = 6
const SOMAXCONN:number = 128
const SOCKET_ADDRESS_SIZE:number = 16
const REQUEST_BUFFER_SIZE:number = 65536
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

function getRequestUrl(raw:number):string {
    let position:number = 0
    let urlStart:number = 0
    let urlLength:number = 0
    let currentByte:number = 0
    let urlBuffer:number = 0

    while (position < REQUEST_BUFFER_SIZE) {
        msvcrt.memcpy(&currentByte, raw + position, 1)
        if (currentByte === 32) {
            urlStart = position + 1
            position = urlStart
            break
        }
        if (currentByte === 0) {
            break
        }
        position = position + 1
    }

    if (urlStart > 0) {
        while (position < REQUEST_BUFFER_SIZE) {
            msvcrt.memcpy(&currentByte, raw + position, 1)
            if (currentByte === 0 || currentByte === 32) {
                break
            }
            position = position + 1
        }
        urlLength = position - urlStart
    }

    urlBuffer = msvcrt.calloc(urlLength + 1, 1)
    if (urlBuffer === 0) {
        msvcrt.printf('http ran out of memory while parsing a request URL\n')
        kernel.ExitProcess(1)
    }
    if (urlLength > 0) {
        msvcrt.memcpy(urlBuffer, raw + urlStart, urlLength)
    }
    return urlBuffer
}

function findHeadersEnd(raw:number, length:number):number {
    let position:number = 0
    let first:number = 0
    let second:number = 0
    let third:number = 0
    let fourth:number = 0

    while (position + 3 < length) {
        msvcrt.memcpy(&first, raw + position, 1)
        msvcrt.memcpy(&second, raw + position + 1, 1)
        msvcrt.memcpy(&third, raw + position + 2, 1)
        msvcrt.memcpy(&fourth, raw + position + 3, 1)
        if (first === 13 && second === 10 && third === 13 && fourth === 10) {
            return position + 4
        }
        position = position + 1
    }
    return 0
}

function getHeaderValueLength(raw:number, headersEnd:number, name:string):number {
    let position:number = 0
    let lineStart:number = 0
    let lineEnd:number = 0
    let colonPosition:number = 0
    let currentByte:number = 0
    let nextByte:number = 0
    let valueStart:number = 0
    let valueEnd:number = 0
    let foundColon:number = 0
    let found:number = 0
    let result:number = 0

    while (position + 1 < headersEnd) {
        msvcrt.memcpy(&currentByte, raw + position, 1)
        msvcrt.memcpy(&nextByte, raw + position + 1, 1)
        if (currentByte === 13 && nextByte === 10) {
            position = position + 2
            break
        }
        position = position + 1
    }

    while (position + 1 < headersEnd) {
        lineStart = position
        lineEnd = position
        while (lineEnd + 1 < headersEnd) {
            msvcrt.memcpy(&currentByte, raw + lineEnd, 1)
            msvcrt.memcpy(&nextByte, raw + lineEnd + 1, 1)
            if (currentByte === 13 && nextByte === 10) {
                break
            }
            lineEnd = lineEnd + 1
        }
        if (lineEnd === lineStart) {
            break
        }

        colonPosition = lineStart
        foundColon = 0
        while (colonPosition < lineEnd) {
            msvcrt.memcpy(&currentByte, raw + colonPosition, 1)
            if (currentByte === 58) {
                foundColon = 1
                break
            }
            colonPosition = colonPosition + 1
        }
        if (foundColon === 1 && headerNameMatches(raw + lineStart, colonPosition - lineStart, name) === 1) {
            if (found === 1) {
                return -2
            }
            found = 1
            valueStart = colonPosition + 1
            while (valueStart < lineEnd) {
                msvcrt.memcpy(&currentByte, raw + valueStart, 1)
                if (currentByte !== 32 && currentByte !== 9) {
                    break
                }
                valueStart = valueStart + 1
            }
            valueEnd = lineEnd
            while (valueEnd > valueStart) {
                msvcrt.memcpy(&currentByte, raw + valueEnd - 1, 1)
                if (currentByte !== 32 && currentByte !== 9) {
                    break
                }
                valueEnd = valueEnd - 1
            }
            result = valueEnd - valueStart
            if (name === 'Content-Length') {
                if (result === 0) {
                    return -1
                }
                let digitPosition:number = valueStart
                let digit:number = 0
                result = 0
                while (digitPosition < valueEnd) {
                    msvcrt.memcpy(&digit, raw + digitPosition, 1)
                    if (digit < 48 || digit > 57) {
                        return -1
                    }
                    if (result > REQUEST_BUFFER_SIZE) {
                        return -4
                    }
                    result = result * 10 + digit - 48
                    if (result > REQUEST_BUFFER_SIZE) {
                        return -4
                    }
                    digitPosition = digitPosition + 1
                }
            }
        }
        position = lineEnd + 2
    }
    if (found === 0) {
        return -3
    }
    return result
}

function hasHeader(raw:number, headersEnd:number, name:string):number {
    const valueLength:number = getHeaderValueLength(raw, headersEnd, name)
    if (valueLength === -3) {
        return 0
    }
    return 1
}

function getRequestQuery(raw:number):string {
    let position:number = 0
    let currentByte:number = 0
    let queryStart:number = 0
    let queryLength:number = 0
    let queryBuffer:number = 0

    while (position < REQUEST_BUFFER_SIZE) {
        msvcrt.memcpy(&currentByte, raw + position, 1)
        if (currentByte === 32) {
            position = position + 1
            break
        }
        if (currentByte === 0) {
            break
        }
        position = position + 1
    }
    while (position < REQUEST_BUFFER_SIZE) {
        msvcrt.memcpy(&currentByte, raw + position, 1)
        if (currentByte === 63) {
            queryStart = position + 1
            position = queryStart
            break
        }
        if (currentByte === 32 || currentByte === 0) {
            break
        }
        position = position + 1
    }
    if (queryStart > 0) {
        while (position < REQUEST_BUFFER_SIZE) {
            msvcrt.memcpy(&currentByte, raw + position, 1)
            if (currentByte === 32 || currentByte === 0) {
                break
            }
            position = position + 1
        }
        queryLength = position - queryStart
    }
    queryBuffer = msvcrt.calloc(queryLength + 1, 1)
    if (queryBuffer === 0) {
        msvcrt.printf('http ran out of memory while parsing a request query\n')
        kernel.ExitProcess(1)
    }
    if (queryLength > 0) {
        msvcrt.memcpy(queryBuffer, raw + queryStart, queryLength)
    }
    return queryBuffer
}

function getRequestBody(raw:number, bodyStart:number, bodyLength:number):string {
    let bodyBuffer:number = msvcrt.calloc(bodyLength + 1, 1)
    if (bodyBuffer === 0) {
        msvcrt.printf('http ran out of memory while copying a request body\n')
        kernel.ExitProcess(1)
    }
    if (bodyLength > 0) {
        msvcrt.memcpy(bodyBuffer, raw + bodyStart, bodyLength)
    }
    return bodyBuffer
}

function queryHexValue(value:number):number {
    if (value >= 48 && value <= 57) {
        return value - 48
    } else if (value >= 65 && value <= 70) {
        return value - 55
    } else if (value >= 97 && value <= 102) {
        return value - 87
    } else {
        return -1
    }
}

function queryHexCharacter(value:number):number {
    if (value < 10) {
        return value + 48
    } else {
        return value + 87
    }
}

function decodeQueryComponent(raw:number, start:number, length:number):string {
    let output:number = msvcrt.calloc(length + 1, 1)
    let sourceIndex:number = start
    let outputIndex:number = 0
    let code:number = 0
    let high:number = 0
    let low:number = 0
    if (output === 0) {
        msvcrt.printf('http ran out of memory while decoding a query component\n')
        kernel.ExitProcess(1)
    }
    while (sourceIndex < start + length) {
        msvcrt.memcpy(&code, raw + sourceIndex, 1)
        if (code === 43) {
            code = 32
        } else if (code === 37 && sourceIndex + 2 < start + length) {
            let highByte:number = 0
            let lowByte:number = 0
            msvcrt.memcpy(&highByte, raw + sourceIndex + 1, 1)
            msvcrt.memcpy(&lowByte, raw + sourceIndex + 2, 1)
            high = queryHexValue(highByte)
            low = queryHexValue(lowByte)
            if (high >= 0 && low >= 0) {
                code = high * 16 + low
                sourceIndex = sourceIndex + 2
            }
        }
        msvcrt.memcpy(output + outputIndex, &code, 1)
        sourceIndex = sourceIndex + 1
        outputIndex = outputIndex + 1
    }
    return output
}

function quoteQueryComponent(value:number):string {
    let length:number = msvcrt.strlen(value)
    let output:number = msvcrt.calloc(length * 6 + 3, 1)
    let sourceIndex:number = 0
    let outputIndex:number = 0
    let code:number = 0
    let slash:number = 92
    let quote:number = 34
    let zero:number = 0
    if (output === 0) {
        msvcrt.printf('http ran out of memory while encoding a query component\n')
        kernel.ExitProcess(1)
    }
    msvcrt.memcpy(output, &quote, 1)
    outputIndex = 1
    while (sourceIndex < length) {
        msvcrt.memcpy(&code, value + sourceIndex, 1)
        if (code === 34 || code === 92) {
            msvcrt.memcpy(output + outputIndex, &slash, 1)
            outputIndex = outputIndex + 1
            msvcrt.memcpy(output + outputIndex, &code, 1)
            outputIndex = outputIndex + 1
        } else if (code < 32) {
            let escaped:number = 92
            let letterU:number = 117
            let zeroDigit:number = 48
            let high:number = code / 16
            let low:number = code % 16
            if (high >= 1) {
                high = high - high % 1
            }
            if (low >= 1) {
                low = low - low % 1
            }
            msvcrt.memcpy(output + outputIndex, &escaped, 1)
            msvcrt.memcpy(output + outputIndex + 1, &letterU, 1)
            msvcrt.memcpy(output + outputIndex + 2, &zeroDigit, 1)
            msvcrt.memcpy(output + outputIndex + 3, &zeroDigit, 1)
            high = queryHexCharacter(high)
            low = queryHexCharacter(low)
            msvcrt.memcpy(output + outputIndex + 4, &high, 1)
            msvcrt.memcpy(output + outputIndex + 5, &low, 1)
            outputIndex = outputIndex + 6
        } else {
            msvcrt.memcpy(output + outputIndex, &code, 1)
            outputIndex = outputIndex + 1
        }
        sourceIndex = sourceIndex + 1
    }
    msvcrt.memcpy(output + outputIndex, &quote, 1)
    msvcrt.memcpy(output + outputIndex + 1, &zero, 1)
    return output
}

function queryKeysEqual(left:number, right:number):boolean {
    let position:number = 0
    let leftByte:number = 0
    let rightByte:number = 0
    while (true) {
        msvcrt.memcpy(&leftByte, left + position, 1)
        msvcrt.memcpy(&rightByte, right + position, 1)
        if (leftByte !== rightByte) {
            return false
        }
        if (leftByte === 0) {
            return true
        }
        position = position + 1
    }
    return false
}

function serializeRequestQuery(raw:number):string {
    let rawLength:number = msvcrt.strlen(raw)
    let entries:number = 0
    let tail:number = 0
    let start:number = 0
    let end:number = 0
    let equalIndex:number = 0
    let valueStart:number = 0
    let keyLength:number = 0
    let valueLength:number = 0
    let currentByte:number = 0
    let key:string = ''
    let value:string = ''
    let encodedKey:string = ''
    let encodedValue:string = ''
    let current:number = 0
    let found:number = 0
    let existingKey:string = ''
    let entry:number = 0
    let valueNode:number = 0
    let valueTail:number = 0
    let count:number = 0
    let outputCapacity:number = rawLength * 8 + 32
    let output:number = msvcrt.calloc(outputCapacity, 1)
    let outputIndex:number = 0
    let entryIndex:number = 0
    let keyJSON:number = 0
    let valueHead:number = 0
    let nextValue:number = 0
    let currentValue:number = 0
    let valueJSON:number = 0
    let valueIndex:number = 0
    let nextEntry:number = 0
    let keyToFree:number = 0
    let keyJsonToFree:number = 0
    let valueToFree:number = 0
    let itemToFree:number = 0

    if (output === 0) {
        msvcrt.printf('http ran out of memory while serializing query parameters\n')
        kernel.ExitProcess(1)
    }

    while (start <= rawLength) {
        end = start
        while (end < rawLength) {
            msvcrt.memcpy(&currentByte, raw + end, 1)
            if (currentByte === 38) {
                break
            }
            end = end + 1
        }
        if (end > start) {
            equalIndex = start
            while (equalIndex < end) {
                msvcrt.memcpy(&currentByte, raw + equalIndex, 1)
                if (currentByte === 61) {
                    break
                }
                equalIndex = equalIndex + 1
            }
            keyLength = equalIndex - start
            if (equalIndex < end) {
                valueStart = equalIndex + 1
            } else {
                valueStart = end
            }
            valueLength = end - valueStart
            key = decodeQueryComponent(raw, start, keyLength)
            value = decodeQueryComponent(raw, valueStart, valueLength)
            encodedValue = quoteQueryComponent(value)

            current = entries
            found = 0
            while (current !== 0) {
                msvcrt.memcpy(&existingKey, current + 8, 8)
                if (queryKeysEqual(existingKey, key)) {
                    found = current
                    break
                }
                msvcrt.memcpy(&current, current, 8)
            }

            if (found !== 0) {
                valueNode = msvcrt.calloc(1, 16)
                if (valueNode === 0) {
                    msvcrt.printf('http ran out of memory while collecting repeated query values\n')
                    kernel.ExitProcess(1)
                }
                msvcrt.memcpy(valueNode + 8, &encodedValue, 8)
                msvcrt.memcpy(&valueTail, found + 24, 8)
                msvcrt.memcpy(valueTail, &valueNode, 8)
                msvcrt.memcpy(found + 24, &valueNode, 8)
                msvcrt.memcpy(&count, found + 32, 8)
                count = count + 1
                msvcrt.memcpy(found + 32, &count, 8)
                msvcrt.free(key)
            } else {
                entry = msvcrt.calloc(1, 48)
                valueNode = msvcrt.calloc(1, 16)
                if (entry === 0 || valueNode === 0) {
                    msvcrt.printf('http ran out of memory while collecting query parameters\n')
                    kernel.ExitProcess(1)
                }
                encodedKey = quoteQueryComponent(key)
                count = 1
                msvcrt.memcpy(entry + 8, &key, 8)
                msvcrt.memcpy(entry + 16, &valueNode, 8)
                msvcrt.memcpy(entry + 24, &valueNode, 8)
                msvcrt.memcpy(entry + 32, &count, 8)
                msvcrt.memcpy(entry + 40, &encodedKey, 8)
                msvcrt.memcpy(valueNode + 8, &encodedValue, 8)
                if (tail === 0) {
                    entries = entry
                } else {
                    msvcrt.memcpy(tail, &entry, 8)
                }
                tail = entry
            }
            msvcrt.free(value)
        }
        start = end + 1
    }

    msvcrt.strcpy(output, '{')
    current = entries
    while (current !== 0) {
        if (entryIndex > 0) {
            msvcrt.strcat(output, ',')
        }
        msvcrt.memcpy(&keyJSON, current + 40, 8)
        msvcrt.strcat(output, keyJSON)
        msvcrt.strcat(output, ':')
        msvcrt.memcpy(&count, current + 32, 8)
        msvcrt.memcpy(&valueHead, current + 16, 8)
        if (count === 1) {
            msvcrt.memcpy(&valueJSON, valueHead + 8, 8)
            msvcrt.strcat(output, valueJSON)
        } else {
            msvcrt.strcat(output, '[')
            currentValue = valueHead
            valueIndex = 0
            while (currentValue !== 0) {
                if (valueIndex > 0) {
                    msvcrt.strcat(output, ',')
                }
                msvcrt.memcpy(&valueJSON, currentValue + 8, 8)
                msvcrt.strcat(output, valueJSON)
                msvcrt.memcpy(&currentValue, currentValue, 8)
                valueIndex = valueIndex + 1
            }
            msvcrt.strcat(output, ']')
        }
        msvcrt.memcpy(&current, current, 8)
        entryIndex = entryIndex + 1
    }
    msvcrt.strcat(output, '}')

    current = entries
    while (current !== 0) {
        msvcrt.memcpy(&nextEntry, current, 8)
        msvcrt.memcpy(&keyToFree, current + 8, 8)
        msvcrt.memcpy(&keyJsonToFree, current + 40, 8)
        msvcrt.memcpy(&currentValue, current + 16, 8)
        while (currentValue !== 0) {
            msvcrt.memcpy(&nextValue, currentValue, 8)
            msvcrt.memcpy(&valueToFree, currentValue + 8, 8)
            msvcrt.free(valueToFree)
            msvcrt.free(currentValue)
            currentValue = nextValue
        }
        msvcrt.free(keyToFree)
        msvcrt.free(keyJsonToFree)
        msvcrt.free(current)
        current = nextEntry
    }
    return output
}

function isJSONContentType(contentType:number):boolean {
    let length:number = msvcrt.strlen(contentType)
    let start:number = 0
    let mediaEnd:number = 0
    let index:number = 0
    let currentByte:number = 0
    let expectedByte:number = 0
    let matches:number = 1
    const applicationJSON:string = 'application/json'
    const jsonSuffix:string = '+json'

    while (start < length) {
        msvcrt.memcpy(&currentByte, contentType + start, 1)
        if (currentByte !== 32 && currentByte !== 9) {
            break
        }
        start = start + 1
    }
    mediaEnd = start
    while (mediaEnd < length) {
        msvcrt.memcpy(&currentByte, contentType + mediaEnd, 1)
        if (currentByte === 59) {
            break
        }
        mediaEnd = mediaEnd + 1
    }
    while (mediaEnd > start) {
        msvcrt.memcpy(&currentByte, contentType + mediaEnd - 1, 1)
        if (currentByte !== 32 && currentByte !== 9) {
            break
        }
        mediaEnd = mediaEnd - 1
    }

    if (mediaEnd - start === 16) {
        index = 0
        matches = 1
        while (index < 16) {
            msvcrt.memcpy(&currentByte, contentType + start + index, 1)
            expectedByte = applicationJSON.charCodeAt(index)
            if (lowercaseHeaderByte(currentByte) !== expectedByte) {
                matches = 0
                break
            }
            index = index + 1
        }
        if (matches === 1) {
            return true
        }
    }
    if (mediaEnd - start >= 5) {
        index = 0
        matches = 1
        while (index < 5) {
            msvcrt.memcpy(&currentByte, contentType + mediaEnd - 5 + index, 1)
            expectedByte = jsonSuffix.charCodeAt(index)
            if (lowercaseHeaderByte(currentByte) !== expectedByte) {
                matches = 0
                break
            }
            index = index + 1
        }
        if (matches === 1) {
            return true
        }
    }
    return false
}

function sendHttpError(clientSocket:number, statusCode:number, statusText:string) {
    let response:number = msvcrt.calloc(128, 1)
    let statusBuffer:number = msvcrt.calloc(16, 1)
    let responseLength:number = 0
    if (response === 0 || statusBuffer === 0) {
        msvcrt.printf('http ran out of memory while preparing an error response\n')
        kernel.ExitProcess(1)
    }
    msvcrt._itoa(statusCode, statusBuffer, 10)
    msvcrt.strcpy(response, 'HTTP/1.1 ')
    msvcrt.strcat(response, statusBuffer)
    msvcrt.strcat(response, ' ')
    msvcrt.strcat(response, statusText)
    msvcrt.strcat(response, '\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
    responseLength = msvcrt.strlen(response)
    sendAll(clientSocket, response, responseLength)
    msvcrt.free(statusBuffer)
    msvcrt.free(response)
}

function lowercaseHeaderByte(value:number):number {
    if (value >= 65 && value <= 90) {
        return value + 32
    }
    return value
}

function headerNameMatches(actual:number, actualLength:number, expected:string):number {
    const expectedLength:number = msvcrt.strlen(expected)
    let position:number = 0
    let actualByte:number = 0
    let expectedByte:number = 0

    if (actualLength !== expectedLength) {
        return 0
    }

    while (position < actualLength) {
        msvcrt.memcpy(&actualByte, actual + position, 1)
        expectedByte = expected.charCodeAt(position)
        if (lowercaseHeaderByte(actualByte) !== lowercaseHeaderByte(expectedByte)) {
            return 0
        }
        position = position + 1
    }
    return 1
}

function getRequestHeaderCopy(raw:number, name:string):number {
    let position:number = 0
    let lineStart:number = 0
    let lineEnd:number = 0
    let colonPosition:number = 0
    let valueStart:number = 0
    let valueEnd:number = 0
    let currentByte:number = 0
    let nextByte:number = 0
    let foundColon:number = 0
    let valueBuffer:number = 0

    while (position < REQUEST_BUFFER_SIZE) {
        msvcrt.memcpy(&currentByte, raw + position, 1)
        if (currentByte === 0) {
            break
        }
        if (currentByte === 13) {
            msvcrt.memcpy(&nextByte, raw + position + 1, 1)
            if (nextByte === 10) {
                position = position + 2
                break
            }
        }
        position = position + 1
    }

    while (position < REQUEST_BUFFER_SIZE) {
        lineStart = position
        lineEnd = position
        while (lineEnd < REQUEST_BUFFER_SIZE) {
            msvcrt.memcpy(&currentByte, raw + lineEnd, 1)
            if (currentByte === 0) {
                break
            }
            if (currentByte === 13) {
                msvcrt.memcpy(&nextByte, raw + lineEnd + 1, 1)
                if (nextByte === 10) {
                    break
                }
            }
            lineEnd = lineEnd + 1
        }
        if (lineEnd === lineStart || currentByte === 0) {
            break
        }
        colonPosition = lineStart
        foundColon = 0
        while (colonPosition < lineEnd) {
            msvcrt.memcpy(&currentByte, raw + colonPosition, 1)
            if (currentByte === 58) {
                foundColon = 1
                break
            }
            colonPosition = colonPosition + 1
        }
        if (foundColon === 1 && headerNameMatches(raw + lineStart, colonPosition - lineStart, name) === 1) {
            valueStart = colonPosition + 1
            while (valueStart < lineEnd) {
                msvcrt.memcpy(&currentByte, raw + valueStart, 1)
                if (currentByte !== 32 && currentByte !== 9) {
                    break
                }
                valueStart = valueStart + 1
            }
            valueEnd = lineEnd
            while (valueEnd > valueStart) {
                msvcrt.memcpy(&currentByte, raw + valueEnd - 1, 1)
                if (currentByte !== 32 && currentByte !== 9) {
                    break
                }
                valueEnd = valueEnd - 1
            }
            valueBuffer = msvcrt.calloc(valueEnd - valueStart + 1, 1)
            if (valueBuffer === 0) {
                msvcrt.printf('http ran out of memory while copying a request header\n')
                kernel.ExitProcess(1)
            }
            if (valueEnd > valueStart) {
                msvcrt.memcpy(valueBuffer, raw + valueStart, valueEnd - valueStart)
            }
            return valueBuffer
        }
        position = lineEnd + 2
    }
    valueBuffer = msvcrt.calloc(1, 1)
    if (valueBuffer === 0) {
        msvcrt.printf('http ran out of memory while copying an empty request header\n')
        kernel.ExitProcess(1)
    }
    return valueBuffer
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

function sendJsonResponse(clientSocket:number, statusCode:number, contentType:number, responseHeaders:number, body:string) {
    const bodyLength:number = msvcrt.strlen(body)
    const contentTypeLength:number = msvcrt.strlen(contentType)
    const responseHeadersLength:number = msvcrt.strlen(responseHeaders)
    const statusPrefixLength:number = msvcrt.strlen('HTTP/1.1 ')
    const statusTextLength:number = msvcrt.strlen(' OK\r\nContent-Type: ')
    const contentLengthTextLength:number = msvcrt.strlen('\r\nContent-Length: ')
    const lineBreakLength:number = msvcrt.strlen('\r\n')
    const connectionTextLength:number = msvcrt.strlen('Connection: close\r\n\r\n')
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
    headersCapacity = statusPrefixLength + statusLength + statusTextLength + contentTypeLength + contentLengthTextLength + lengthTextLength + lineBreakLength + responseHeadersLength + connectionTextLength + 1
    headers = msvcrt.calloc(headersCapacity, 1)
    if (headers === 0) {
        msvcrt.printf('http ran out of memory while preparing a JSON response\n')
        kernel.ExitProcess(1)
    }

    msvcrt.strcpy(headers, 'HTTP/1.1 ')
    msvcrt.strcat(headers, statusBuffer)
    msvcrt.strcat(headers, ' OK\r\nContent-Type: ')
    msvcrt.strcat(headers, contentType)
    msvcrt.strcat(headers, '\r\nContent-Length: ')
    msvcrt.strcat(headers, lengthBuffer)
    msvcrt.strcat(headers, '\r\n')
    msvcrt.strcat(headers, responseHeaders)
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
    url:string
    queryBuffer:string
    query:DynamicJSON
    bodyText:string
    body:DynamicJSON
    bodyIsJSON:boolean = false
    queryValid:number = 0
    bodyValid:number = 0
    headerValueAllocations:number = 0

    constructor(raw:number, bodyStart:number, bodyLength:number) {
        let queryJSON:string = ''
        let actualBodyLength:number = 0
        this.raw = raw
        this.method = ''
        this.headerValueAllocations = 0
        this.queryValid = 0
        this.bodyValid = 0
        this.bodyIsJSON = false
        this.url = getRequestUrl(raw)
        this.queryBuffer = getRequestQuery(raw)
        queryJSON = serializeRequestQuery(this.queryBuffer)
        this.query = JSON.parse(queryJSON)
        msvcrt.free(queryJSON)
        if (JSON.isValid(this.query)) {
            this.queryValid = 1
        }
        this.bodyText = getRequestBody(raw, bodyStart, bodyLength)
        actualBodyLength = msvcrt.strlen(this.bodyText)
        if (actualBodyLength !== bodyLength) {
            this.bodyValid = 0
        } else {
            const contentType:number = getRequestHeaderCopy(raw, 'Content-Type')
            if (isJSONContentType(contentType)) {
                this.bodyIsJSON = true
                this.body = JSON.parse(this.bodyText)
            } else {
                this.body = JSON.fromString(this.bodyText)
            }
            msvcrt.free(contentType)
            if (JSON.isValid(this.body)) {
                this.bodyValid = 1
            }
        }
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

    getHeader(name:string):string {
        let position:number = 0
        let lineStart:number = 0
        let lineEnd:number = 0
        let colonPosition:number = 0
        let valueStart:number = 0
        let valueEnd:number = 0
        let currentByte:number = 0
        let nextByte:number = 0
        let foundColon:number = 0

        while (position < REQUEST_BUFFER_SIZE) {
            msvcrt.memcpy(&currentByte, this.raw + position, 1)
            if (currentByte === 0) {
                return ''
            }
            if (currentByte === 13) {
                msvcrt.memcpy(&nextByte, this.raw + position + 1, 1)
                if (nextByte === 10) {
                    position = position + 2
                    break
                }
            }
            position = position + 1
        }

        while (position < REQUEST_BUFFER_SIZE) {
            lineStart = position
            lineEnd = position
            while (lineEnd < REQUEST_BUFFER_SIZE) {
                msvcrt.memcpy(&currentByte, this.raw + lineEnd, 1)
                if (currentByte === 0) {
                    return ''
                }
                if (currentByte === 13) {
                    msvcrt.memcpy(&nextByte, this.raw + lineEnd + 1, 1)
                    if (nextByte === 10) {
                        break
                    }
                }
                lineEnd = lineEnd + 1
            }
            if (lineEnd === lineStart) {
                return ''
            }

            colonPosition = lineStart
            foundColon = 0
            while (colonPosition < lineEnd) {
                msvcrt.memcpy(&currentByte, this.raw + colonPosition, 1)
                if (currentByte === 58) {
                    foundColon = 1
                    break
                }
                colonPosition = colonPosition + 1
            }
            if (foundColon === 1 && headerNameMatches(this.raw + lineStart, colonPosition - lineStart, name) === 1) {
                valueStart = colonPosition + 1
                while (valueStart < lineEnd) {
                    msvcrt.memcpy(&currentByte, this.raw + valueStart, 1)
                    if (currentByte !== 32 && currentByte !== 9) {
                        break
                    }
                    valueStart = valueStart + 1
                }
                valueEnd = lineEnd
                while (valueEnd > valueStart) {
                    msvcrt.memcpy(&currentByte, this.raw + valueEnd - 1, 1)
                    if (currentByte !== 32 && currentByte !== 9) {
                        break
                    }
                    valueEnd = valueEnd - 1
                }
                let valueBuffer:number = msvcrt.calloc(valueEnd - valueStart + 1, 1)
                let allocationNode:number = msvcrt.calloc(16, 1)
                let nextAllocation:number = this.headerValueAllocations
                if (valueBuffer === 0) {
                    msvcrt.printf('http ran out of memory while copying a request header\n')
                    kernel.ExitProcess(1)
                }
                if (allocationNode === 0) {
                    msvcrt.free(valueBuffer)
                    msvcrt.printf('http ran out of memory while tracking a request header\n')
                    kernel.ExitProcess(1)
                }
                if (valueEnd > valueStart) {
                    msvcrt.memcpy(valueBuffer, this.raw + valueStart, valueEnd - valueStart)
                }
                msvcrt.memcpy(allocationNode, &valueBuffer, 8)
                msvcrt.memcpy(allocationNode + 8, &nextAllocation, 8)
                this.headerValueAllocations = allocationNode
                return valueBuffer
            }
            position = lineEnd + 2
        }
        return ''
    }

    cleanup() {
        let allocations:number = this.headerValueAllocations
        let valueBuffer:number = 0
        let nextAllocation:number = 0
        while (allocations !== 0) {
            msvcrt.memcpy(&valueBuffer, allocations, 8)
            msvcrt.memcpy(&nextAllocation, allocations + 8, 8)
            msvcrt.free(valueBuffer)
            msvcrt.free(allocations)
            allocations = nextAllocation
        }
        JSON.free(this.body)
        JSON.free(this.query)
        msvcrt.free(this.bodyText)
        msvcrt.free(this.queryBuffer)
        msvcrt.free(this.url)
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
    contentTypeSet:number = 0
    responseHeaders:number

    constructor(clientSocket:number) {
        const defaultContentTypeLength:number = msvcrt.strlen('text/plain; charset=utf-8')
        this.clientSocket = clientSocket
        this.contentType = msvcrt.calloc(defaultContentTypeLength + 1, 1)
        this.responseHeaders = msvcrt.calloc(1, 1)
        msvcrt.strcpy(this.contentType, 'text/plain; charset=utf-8')
    }

    setHeader(name:string, value:string) {
        let valueLength:number = 0
        let nameLength:number = 0
        let headerValueLength:number = 0
        let responseHeadersLength:number = 0
        let newHeaders:number = 0
        if (name === 'Content-Type') {
            valueLength = msvcrt.strlen(value)
            this.contentType = msvcrt.realloc(this.contentType, valueLength + 1)
            if (this.contentType === 0) {
                msvcrt.printf('http ran out of memory while setting a response header\n')
                kernel.ExitProcess(1)
            }
            msvcrt.strcpy(this.contentType, value)
            this.contentTypeSet = 1
        } else {
            responseHeadersLength = msvcrt.strlen(this.responseHeaders)
            nameLength = msvcrt.strlen(name)
            headerValueLength = msvcrt.strlen(value)
            valueLength = nameLength + headerValueLength + 5
            newHeaders = msvcrt.realloc(this.responseHeaders, responseHeadersLength + valueLength)
            if (newHeaders === 0) {
                msvcrt.printf('http ran out of memory while setting a response header\n')
                kernel.ExitProcess(1)
            }
            this.responseHeaders = newHeaders
            msvcrt.strcat(this.responseHeaders, name)
            msvcrt.strcat(this.responseHeaders, ': ')
            msvcrt.strcat(this.responseHeaders, value)
            msvcrt.strcat(this.responseHeaders, '\r\n')
        }
    }

    json(body:StaticJSON) {
        if (this.contentTypeSet === 0) {
            const jsonContentTypeLength:number = msvcrt.strlen('application/json; charset=utf-8')
            this.contentType = msvcrt.realloc(this.contentType, jsonContentTypeLength + 1)
            if (this.contentType === 0) {
                msvcrt.printf('http ran out of memory while setting a response content type\n')
                kernel.ExitProcess(1)
            }
            msvcrt.strcpy(this.contentType, 'application/json; charset=utf-8')
        }
        sendJsonResponse(this.clientSocket, this.statusCode, this.contentType, this.responseHeaders, body)
        msvcrt.free(this.contentType)
        msvcrt.free(this.responseHeaders)
    }

    end(body:string) {
        const bodyLength:number = msvcrt.strlen(body)
        const responseHeadersLength:number = msvcrt.strlen(this.responseHeaders)
        const statusPrefixLength:number = msvcrt.strlen('HTTP/1.1 ')
        const statusTextLength:number = msvcrt.strlen(' OK\r\nContent-Type: ')
        const contentLengthTextLength:number = msvcrt.strlen('\r\nContent-Length: ')
        const lineBreakLength:number = msvcrt.strlen('\r\n')
        const connectionTextLength:number = msvcrt.strlen('Connection: close\r\n\r\n')
        const contentTypeLength:number = msvcrt.strlen(this.contentType)
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

        headersCapacity = statusPrefixLength + statusLength + statusTextLength + contentTypeLength + contentLengthTextLength + lengthTextLength + lineBreakLength + responseHeadersLength + connectionTextLength + 1
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
        msvcrt.strcat(headers, this.responseHeaders)
        msvcrt.strcat(headers, 'Connection: close\r\n\r\n')

        headersLength = msvcrt.strlen(headers)
        sendAll(this.clientSocket, headers, headersLength)
        sendAll(this.clientSocket, bodyBuffer, bodyLength)

        msvcrt.free(bodyBuffer)
        msvcrt.free(headers)
        msvcrt.free(statusBuffer)
        msvcrt.free(lengthBuffer)
        msvcrt.free(this.contentType)
        msvcrt.free(this.responseHeaders)
    }
}

function dispatchRequest(requestListener:Function, requestBuffer:number, clientSocket:number, bodyStart:number, bodyLength:number) {
    msvcrt.printf('trace: dispatch start\n')
    msvcrt.fflush(0)
    const request:Request = new Request(requestBuffer, bodyStart, bodyLength)
    if (request.queryValid === 0 || request.bodyValid === 0) {
        request.cleanup()
        sendHttpError(clientSocket, 400, 'Bad Request')
        return
    }
    const response:Response = new Response(clientSocket)
    msvcrt.printf('trace: response ready\n')
    msvcrt.fflush(0)
    requestListener(request, response)
    msvcrt.printf('trace: listener returned\n')
    msvcrt.fflush(0)
    request.cleanup()
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

            let requestBuffer:number = msvcrt.calloc(REQUEST_BUFFER_SIZE + 1, 1)
            let bytesReceived:number = 0
            let totalReceived:number = 0
            let headersEnd:number = 0
            let contentLength:number = -1
            let expectedLength:number = 0
            let receiveFailed:number = 0
            bytesReceived = 0
            totalReceived = 0
            headersEnd = 0
            contentLength = -1
            expectedLength = 0
            receiveFailed = 0
            if (requestBuffer === 0) {
                ws2_32.closesocket(clientSocket)
                msvcrt.printf('http ran out of memory while receiving a request\n')
                kernel.ExitProcess(1)
            }

            while (headersEnd === 0 && totalReceived < REQUEST_BUFFER_SIZE) {
                bytesReceived = ws2_32.recv(clientSocket, requestBuffer + totalReceived, REQUEST_BUFFER_SIZE - totalReceived, 0)
                if (bytesReceived <= 0) {
                    receiveFailed = 1
                    break
                }
                totalReceived = totalReceived + bytesReceived
                headersEnd = findHeadersEnd(requestBuffer, totalReceived)
            }
            if (receiveFailed === 1) {
                msvcrt.printf('http failed while receiving a request\n')
                msvcrt.fflush(0)
            } else if (headersEnd === 0) {
                sendHttpError(clientSocket, 431, 'Request Header Fields Too Large')
            } else if (hasHeader(requestBuffer, headersEnd, 'Transfer-Encoding') === 1) {
                sendHttpError(clientSocket, 501, 'Not Implemented')
            } else {
                contentLength = getHeaderValueLength(requestBuffer, headersEnd, 'Content-Length')
                if (contentLength === -2 || contentLength === -1) {
                    sendHttpError(clientSocket, 400, 'Bad Request')
                } else if (contentLength === -4) {
                    sendHttpError(clientSocket, 413, 'Content Too Large')
                } else if (contentLength > REQUEST_BUFFER_SIZE - headersEnd) {
                    sendHttpError(clientSocket, 413, 'Content Too Large')
                } else if (contentLength === -3) {
                    dispatchRequest(requestListener, requestBuffer, clientSocket, headersEnd, 0)
                } else {
                    expectedLength = headersEnd + contentLength
                    while (totalReceived < expectedLength) {
                        bytesReceived = ws2_32.recv(clientSocket, requestBuffer + totalReceived, expectedLength - totalReceived, 0)
                        if (bytesReceived <= 0) {
                            receiveFailed = 1
                            break
                        }
                        totalReceived = totalReceived + bytesReceived
                    }
                    if (receiveFailed === 1) {
                        sendHttpError(clientSocket, 400, 'Bad Request')
                    } else {
                        dispatchRequest(requestListener, requestBuffer, clientSocket, headersEnd, contentLength)
                    }
                }
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
