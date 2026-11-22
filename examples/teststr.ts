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

kernel.ExitProcess(0)