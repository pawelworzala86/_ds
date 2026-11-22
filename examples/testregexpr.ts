import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

msvcrt.printf('start\n')



let str: string = 'Hello, World!'

let strings:string[] = str.split(/(\,\ )/gm)

for(let i = 0; i < strings.length; i++) {
    msvcrt.printf('%s\n', strings[i])
}

let capturedText: string = 'one,two;three'
let capturedParts: string[] = capturedText.split(/([,;])/g)
for(let u = 0; u < capturedParts.length; u++) {
    msvcrt.printf('%s\n', capturedParts[u])
}

let whitespaceText: string = 'red   green\tblue'
let whitespaceParts: string[] = whitespaceText.split(/\s+/g)
for(let j = 0; j < whitespaceParts.length; j++) {
    msvcrt.printf('%s\n', whitespaceParts[j])
}

let punctuationText: string = 'alpha,,beta!!!gamma?delta'
let punctuationParts: string[] = punctuationText.split(/[,!?]+/g)
for(let k = 0; k < punctuationParts.length; k++) {
    msvcrt.printf('%s\n', punctuationParts[k])
}

let alternateText: string = 'red,green;blue'
let alternateParts: string[] = alternateText.split(/(?:,|;)/g)
for(let m = 0; m < alternateParts.length; m++) {
    msvcrt.printf('%s\n', alternateParts[m])
}

let numberText: string = 'item12box3456'
let numberParts: string[] = numberText.split(/[0-9]{2,3}/g)
for(let n = 0; n < numberParts.length; n++) {
    msvcrt.printf('%s\n', numberParts[n])
}

let caseText: string = 'AxxbXXc'
let caseParts: string[] = caseText.split(/[x]+/i)
for(let p = 0; p < caseParts.length; p++) {
    msvcrt.printf('%s\n', caseParts[p])
}

let repeatedText: string = 'left cattt right ct end'
let repeatedParts: string[] = repeatedText.split(/ca*t+/g)
for(let t = 0; t < repeatedParts.length; t++) {
    msvcrt.printf('%s\n', repeatedParts[t])
}

let dotText: string = 'a\nb'
let dotParts: string[] = dotText.split(/.\n./s)
for(let q = 0; q < dotParts.length; q++) {
    msvcrt.printf('%s\n', dotParts[q])
}

let shorthandText: string = 'ID: 17; code: 204'
let shorthandParts: string[] = shorthandText.split(/\d+/g)
for(let r = 0; r < shorthandParts.length; r++) {
    msvcrt.printf('%s\n', shorthandParts[r])
}

let slashText: string = 'a/b//c'
let slashParts: string[] = slashText.split(/\//g)
for(let s = 0; s < slashParts.length; s++) {
    msvcrt.printf('%s\n', slashParts[s])
}





let str2: string = 'Hello, World! World!'

str2 = str2.replace('Hello', 'Hi')
str2 = str2.replace(/World/g, 'there')
console.log(str2)

let firstOnly: string = 'cat cat'
firstOnly = firstOnly.replace(/cat/, 'dog')
console.log(firstOnly)

kernel.ExitProcess(0)