import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

function assertNumber(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('string edge test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

function assertString(actual:string, expected:string) {
    if (actual !== expected) {
        msvcrt.printf('string edge test failed: expected "%s", received "%s"\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

const text:string = 'AB'
const lastIndex:number = text.length - 1
assertNumber(text.charCodeAt(0), 65)
assertNumber(text.charCodeAt(lastIndex), 66)
assertNumber(text.charCodeAt(text.length), 0)

let emptyText:string = ''
let emptyIndex:number = -1
let emptyMissingIndex:number = 0
emptyIndex = emptyText.indexOf('')
emptyMissingIndex = emptyText.indexOf('x')
assertNumber(emptyIndex, 0)
assertNumber(emptyMissingIndex, -1)

let includesEmpty:boolean = false
let includesMissing:boolean = true
let startsWithEmpty:boolean = false
let startsWithMissing:boolean = true
let endsWithEmpty:boolean = false
let endsWithMissing:boolean = true
includesEmpty = emptyText.includes('')
includesMissing = emptyText.includes('x')
startsWithEmpty = emptyText.startsWith('')
startsWithMissing = emptyText.startsWith('x')
endsWithEmpty = emptyText.endsWith('')
endsWithMissing = emptyText.endsWith('x')
if (!includesEmpty || includesMissing
    || !startsWithEmpty || startsWithMissing
    || !endsWithEmpty || endsWithMissing) {
    msvcrt.printf('string edge test failed: empty string search\n')
    kernel.ExitProcess(1)
}

let emptySubstring:string = 'placeholder'
let emptyReversedSubstring:string = 'placeholder'
let emptySlice:string = 'placeholder'
let emptyNegativeSlice:string = 'placeholder'
let emptyRangedSlice:string = 'placeholder'
emptySubstring = emptyText.substring(0)
emptyReversedSubstring = emptyText.substring(1, 0)
emptySlice = emptyText.slice(0)
emptyNegativeSlice = emptyText.slice(-1)
emptyRangedSlice = emptyText.slice(0, 0)
assertString(emptySubstring, '')
assertString(emptyReversedSubstring, '')
assertString(emptySlice, '')
assertString(emptyNegativeSlice, '')
assertString(emptyRangedSlice, '')

msvcrt.printf('string edge tests passed\n')
kernel.ExitProcess(0)
