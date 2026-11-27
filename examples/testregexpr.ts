import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

function assertNumber(actual:number, expected:number, name:string) {
    if (actual !== expected) {
        msvcrt.printf('regexp test failed: %s expected length %i, received %i\n', name, expected, actual)
        kernel.ExitProcess(1)
    }
}

function assertText(actual:string, expected:string, name:string) {
    if (actual !== expected) {
        msvcrt.printf('regexp test failed: %s expected "%s", received "%s"\n', name, expected, actual)
        kernel.ExitProcess(1)
    }
}

msvcrt.printf('start\n')



let str: string = 'Hello, World!'

let strings:string[] = str.split(/(\,\ )/gm)

for(let i = 0; i < strings.length; i++) {
    msvcrt.printf('%s\n', strings[i])
}
assertNumber(strings.length, 3, 'basic split')
assertText(strings[0], 'Hello', 'basic split[0]')
assertText(strings[1], ', ', 'basic split[1]')
assertText(strings[2], 'World!', 'basic split[2]')

let capturedText: string = 'one,two;three'
let capturedParts: string[] = capturedText.split(/([,;])/g)
for(let u = 0; u < capturedParts.length; u++) {
    msvcrt.printf('%s\n', capturedParts[u])
}
assertNumber(capturedParts.length, 5, 'captured separators')
assertText(capturedParts[0], 'one', 'captured separators[0]')
assertText(capturedParts[1], ',', 'captured separators[1]')
assertText(capturedParts[2], 'two', 'captured separators[2]')
assertText(capturedParts[3], ';', 'captured separators[3]')
assertText(capturedParts[4], 'three', 'captured separators[4]')

let whitespaceText: string = 'red   green\tblue'
let whitespaceParts: string[] = whitespaceText.split(/\s+/g)
for(let j = 0; j < whitespaceParts.length; j++) {
    msvcrt.printf('%s\n', whitespaceParts[j])
}
assertNumber(whitespaceParts.length, 3, 'whitespace split')
assertText(whitespaceParts[0], 'red', 'whitespace split[0]')
assertText(whitespaceParts[1], 'green', 'whitespace split[1]')
assertText(whitespaceParts[2], 'blue', 'whitespace split[2]')

let punctuationText: string = 'alpha,,beta!!!gamma?delta'
let punctuationParts: string[] = punctuationText.split(/[,!?]+/g)
for(let k = 0; k < punctuationParts.length; k++) {
    msvcrt.printf('%s\n', punctuationParts[k])
}
assertNumber(punctuationParts.length, 4, 'punctuation split')
assertText(punctuationParts[0], 'alpha', 'punctuation split[0]')
assertText(punctuationParts[1], 'beta', 'punctuation split[1]')
assertText(punctuationParts[2], 'gamma', 'punctuation split[2]')
assertText(punctuationParts[3], 'delta', 'punctuation split[3]')

let alternateText: string = 'red,green;blue'
let alternateParts: string[] = alternateText.split(/(?:,|;)/g)
for(let m = 0; m < alternateParts.length; m++) {
    msvcrt.printf('%s\n', alternateParts[m])
}
assertNumber(alternateParts.length, 3, 'alternate split')
assertText(alternateParts[0], 'red', 'alternate split[0]')
assertText(alternateParts[1], 'green', 'alternate split[1]')
assertText(alternateParts[2], 'blue', 'alternate split[2]')

let numberText: string = 'item12box3456'
let numberParts: string[] = numberText.split(/[0-9]{2,3}/g)
for(let n = 0; n < numberParts.length; n++) {
    msvcrt.printf('%s\n', numberParts[n])
}
assertNumber(numberParts.length, 3, 'number split')
assertText(numberParts[0], 'item', 'number split[0]')
assertText(numberParts[1], 'box', 'number split[1]')
assertText(numberParts[2], '6', 'number split[2]')

let caseText: string = 'AxxbXXc'
let caseParts: string[] = caseText.split(/[x]+/i)
for(let p = 0; p < caseParts.length; p++) {
    msvcrt.printf('%s\n', caseParts[p])
}
assertNumber(caseParts.length, 3, 'case-insensitive split')
assertText(caseParts[0], 'A', 'case-insensitive split[0]')
assertText(caseParts[1], 'b', 'case-insensitive split[1]')
assertText(caseParts[2], 'c', 'case-insensitive split[2]')

let repeatedText: string = 'left cattt right ct end'
let repeatedParts: string[] = repeatedText.split(/ca*t+/g)
for(let t = 0; t < repeatedParts.length; t++) {
    msvcrt.printf('%s\n', repeatedParts[t])
}
assertNumber(repeatedParts.length, 3, 'repeated split')
assertText(repeatedParts[0], 'left ', 'repeated split[0]')
assertText(repeatedParts[1], ' right ', 'repeated split[1]')
assertText(repeatedParts[2], ' end', 'repeated split[2]')

let dotText: string = 'a\nb'
let dotParts: string[] = dotText.split(/.\n./s)
for(let q = 0; q < dotParts.length; q++) {
    msvcrt.printf('%s\n', dotParts[q])
}
assertNumber(dotParts.length, 2, 'dot-all split')
assertText(dotParts[0], '', 'dot-all split[0]')
assertText(dotParts[1], '', 'dot-all split[1]')

let shorthandText: string = 'ID: 17; code: 204'
let shorthandParts: string[] = shorthandText.split(/\d+/g)
for(let r = 0; r < shorthandParts.length; r++) {
    msvcrt.printf('%s\n', shorthandParts[r])
}
assertNumber(shorthandParts.length, 3, 'digit split')
assertText(shorthandParts[0], 'ID: ', 'digit split[0]')
assertText(shorthandParts[1], '; code: ', 'digit split[1]')
assertText(shorthandParts[2], '', 'digit split[2]')

let slashText: string = 'a/b//c'
let slashParts: string[] = slashText.split(/\//g)
for(let s = 0; s < slashParts.length; s++) {
    msvcrt.printf('%s\n', slashParts[s])
}
assertNumber(slashParts.length, 4, 'slash split')
assertText(slashParts[0], 'a', 'slash split[0]')
assertText(slashParts[1], 'b', 'slash split[1]')
assertText(slashParts[2], '', 'slash split[2]')
assertText(slashParts[3], 'c', 'slash split[3]')





let str2: string = 'Hello, World! World!'

str2 = str2.replace('Hello', 'Hi')
str2 = str2.replace(/World/g, 'there')
console.log(str2)
if (str2 !== 'Hi, there! there!') {
    msvcrt.printf('regexp test failed: global replace returned "%s"\n', str2)
    kernel.ExitProcess(1)
}

let firstOnly: string = 'cat cat'
firstOnly = firstOnly.replace(/cat/, 'dog')
console.log(firstOnly)
if (firstOnly !== 'dog cat') {
    msvcrt.printf('regexp test failed: first-only replace returned "%s"\n', firstOnly)
    kernel.ExitProcess(1)
}

msvcrt.printf('regexp tests passed\n')
kernel.ExitProcess(0)