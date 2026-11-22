import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

msvcrt.printf('start\n')



let str: string = 'Hello, World!'

for(let i = 0; i < str.length; i++) {
    msvcrt.printf('%c\n', str.charCodeAt(i))
}

let str2: string = 'Hello\n'

str = str2
str += 'test'

msvcrt.printf(' %s\n', str2)
msvcrt.printf(' %s\n', str)


let strings:string[] = str.split(' ')

for(let i = 0; i < strings.length; i++) {
    msvcrt.printf('%s\n', strings[i])
}

let phrase: string = 'compiler text'
let textIndex: number = phrase.indexOf('text')
let emptyIndex: number = phrase.indexOf('')
let missingIndex: number = phrase.indexOf('missing')
let hasText: boolean = phrase.includes('text')
let hasEmpty: boolean = phrase.includes('')
let hasMissing: boolean = phrase.includes('missing')
let startsCorrectly: boolean = phrase.startsWith('compiler')
let startsIncorrectly: boolean = phrase.startsWith('text')
let endsCorrectly: boolean = phrase.endsWith('text')
let endsWithEmpty: boolean = phrase.endsWith('')
let endsWithTooLong: boolean = phrase.endsWith('compiler text extra')

msvcrt.printf('indexOf: %d, empty: %d, missing: %d\n', textIndex, emptyIndex, missingIndex)
msvcrt.printf('includes: %d, empty: %d, missing: %d\n', hasText, hasEmpty, hasMissing)
msvcrt.printf('startsWith: %d, missing: %d\n', startsCorrectly, startsIncorrectly)
msvcrt.printf('endsWith: %d, empty: %d, too long: %d\n', endsCorrectly, endsWithEmpty, endsWithTooLong)

let substringText: string = '0123456789'
let substringRange: string = 'placeholder'
let substringToEnd: string = 'placeholder'
let substringReversed: string = 'placeholder'
let substringClamped: string = 'placeholder'
substringRange = substringText.substring(2, 6)
substringToEnd = substringText.substring(7)
substringReversed = substringText.substring(6, 2)
substringClamped = substringText.substring(-3, 99)
msvcrt.printf('substring: %s, to end: %s, reversed: %s, clamped: %s\n', substringRange, substringToEnd, substringReversed, substringClamped)

let sliceText: string = '0123456789'
let sliceRange: string = 'placeholder'
let sliceFromEnd: string = 'placeholder'
let sliceNegativeRange: string = 'placeholder'
let sliceEmpty: string = 'placeholder'
sliceRange = sliceText.slice(2, 6)
sliceFromEnd = sliceText.slice(-4)
sliceNegativeRange = sliceText.slice(-7, -3)
sliceEmpty = sliceText.slice(8, 3)
msvcrt.printf('slice: %s, from end: %s, negative range: %s, empty: "%s"\n', sliceRange, sliceFromEnd, sliceNegativeRange, sliceEmpty)

let concatText: string = 'compiler'
let concatenated: string = 'placeholder'
concatenated = concatText.concat(' text!')
msvcrt.printf('concat: %s\n', concatenated)

let replaceText: string = 'red red'
let firstReplace: string = 'placeholder'
let allReplace: string = 'placeholder'
firstReplace = replaceText.replace('red', 'blue')
allReplace = replaceText.replace(/red/g, 'blue')
msvcrt.printf('replace first: %s, global: %s\n', firstReplace, allReplace)

function replaceRedWithBlue(match:string){
    return match.replace('red', 'blue')
}

let callbackReplace: string = 'placeholder'
callbackReplace = replaceText.replace(/red/g, replaceRedWithBlue)
msvcrt.printf('replace callback: %s\n', callbackReplace)

kernel.ExitProcess(0)