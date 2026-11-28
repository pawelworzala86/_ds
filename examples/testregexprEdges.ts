import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

function assertNumber(actual:number, expected:number, name:string) {
    if (actual !== expected) {
        msvcrt.printf('regexp edge test failed: %s expected length %i, received %i\n', name, expected, actual)
        kernel.ExitProcess(1)
    }
}

function assertText(actual:string, expected:string, name:string) {
    if (actual !== expected) {
        msvcrt.printf('regexp edge test failed: %s expected "%s", received "%s"\n', name, expected, actual)
        kernel.ExitProcess(1)
    }
}

let leadingText:string = ',alpha'
let leadingParts:string[] = leadingText.split(/,/g)
assertNumber(leadingParts.length, 2, 'leading separator')
assertText(leadingParts[0], '', 'leading separator[0]')
assertText(leadingParts[1], 'alpha', 'leading separator[1]')

let trailingText:string = 'alpha,'
let trailingParts:string[] = trailingText.split(/,/g)
assertNumber(trailingParts.length, 2, 'trailing separator')
assertText(trailingParts[0], 'alpha', 'trailing separator[0]')
assertText(trailingParts[1], '', 'trailing separator[1]')

let adjacentText:string = 'alpha,,beta'
let adjacentParts:string[] = adjacentText.split(/,/g)
assertNumber(adjacentParts.length, 3, 'adjacent separators')
assertText(adjacentParts[0], 'alpha', 'adjacent separators[0]')
assertText(adjacentParts[1], '', 'adjacent separators[1]')
assertText(adjacentParts[2], 'beta', 'adjacent separators[2]')

let caseText:string = 'AxbXc'
let caseSensitiveParts:string[] = caseText.split(/x/)
assertNumber(caseSensitiveParts.length, 2, 'case-sensitive split')
assertText(caseSensitiveParts[0], 'A', 'case-sensitive split[0]')
assertText(caseSensitiveParts[1], 'bXc', 'case-sensitive split[1]')

let caseInsensitiveParts:string[] = caseText.split(/x/i)
assertNumber(caseInsensitiveParts.length, 3, 'case-insensitive split')
assertText(caseInsensitiveParts[0], 'A', 'case-insensitive split[0]')
assertText(caseInsensitiveParts[1], 'b', 'case-insensitive split[1]')
assertText(caseInsensitiveParts[2], 'c', 'case-insensitive split[2]')

let dotText:string = 'a\nb'
let dotAllParts:string[] = dotText.split(/./s)
assertNumber(dotAllParts.length, 4, 'dot-all flag')
assertText(dotAllParts[0], '', 'dot-all flag[0]')
assertText(dotAllParts[1], '', 'dot-all flag[1]')
assertText(dotAllParts[2], '', 'dot-all flag[2]')
assertText(dotAllParts[3], '', 'dot-all flag[3]')

let repeatedNameText:string = 'catdog'
let repeatedNameParts:string[] = repeatedNameText.split(/(?<word>cat)\k<word>/)
assertNumber(repeatedNameParts.length, 1, 'named backreference mismatch')
assertText(repeatedNameParts[0], 'catdog', 'named backreference mismatch[0]')

let repeatedNameReplace:string = 'catcat-catdog'
repeatedNameReplace = repeatedNameReplace.replace(/(?<word>cat)\k<word>/, 'matched')
assertText(repeatedNameReplace, 'matched-catdog', 'named backreference first match')

let repeatedReferenceText:string = 'ababab!'
let repeatedReferenceParts:string[] = repeatedReferenceText.split(/(?<pair>ab)\k<pair>\k<pair>/)
assertNumber(repeatedReferenceParts.length, 2, 'reused named backreference')
assertText(repeatedReferenceParts[0], '', 'reused named backreference[0]')
assertText(repeatedReferenceParts[1], '!', 'reused named backreference[1]')

msvcrt.printf('regexp edge tests passed\n')
kernel.ExitProcess(0)
