import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'
import * as fs from './system/fs.ts'


function assertString(actual:string, expected:string) {
    if (actual !== expected) {
        cleanup()
        msvcrt.printf('filesystem test failed: expected "%s", received "%s"\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

const contents:string = 'Hello, World!'
let tempPath:ArrayBuffer = 0
let fileName:ArrayBuffer = 0
let emptyFileName:ArrayBuffer = 0
tempPath = msvcrt.calloc(260, 1)
fileName = msvcrt.calloc(260, 1)
emptyFileName = msvcrt.calloc(260, 1)

function cleanup() {
    kernel.DeleteFileA(fileName)
    kernel.DeleteFileA(emptyFileName)
}

function fail(message:string) {
    cleanup()
    msvcrt.printf('filesystem test failed: %s\n', message)
    kernel.ExitProcess(1)
}

const tempPathLength:number = kernel.GetTempPathA(260, tempPath)
if (tempPathLength === 0 || tempPathLength > 240) {
    fail('unable to get temporary directory')
}

msvcrt.strcpy(fileName, tempPath)
msvcrt.strcat(fileName, 'ds-testfs-data.txt')
msvcrt.strcpy(emptyFileName, tempPath)
msvcrt.strcat(emptyFileName, 'ds-testfs-empty.txt')

fs.writeFileSync(fileName, contents)
const readContents:string = fs.readFileSync(fileName).toString()
assertString(readContents, contents)

fs.writeFileSync(emptyFileName, '')
const readEmptyContents:string = fs.readFileSync(emptyFileName).toString()
assertString(readEmptyContents, '')

const dirs:string[] = fs.readdirSync(tempPath)
console.log(dirs)

cleanup()

msvcrt.printf('filesystem tests passed\n')
kernel.ExitProcess(0)