import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'
import * as fs from './system/fs.ts'


function assertString(actual:string, expected:string) {
    if (actual !== expected) {
        msvcrt.printf('filesystem test failed: expected "%s", received "%s"\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

const contents:string = 'Hello, World!'
const fileName:string = 'testfs-data.txt'
const emptyFileName:string = 'testfs-empty.txt'

fs.writeFileSync(fileName, contents)
const readContents:string = fs.readFileSync(fileName).toString()
assertString(readContents, contents)

fs.writeFileSync(emptyFileName, '')
const readEmptyContents:string = fs.readFileSync(emptyFileName).toString()
assertString(readEmptyContents, '')

kernel.DeleteFileA(fileName)
kernel.DeleteFileA(emptyFileName)

msvcrt.printf('filesystem tests passed\n')
kernel.ExitProcess(0)