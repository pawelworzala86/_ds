import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

type MyType = number
type MyTypeStr = string
type MyTypeArray = MyType[]
type MyRecord = AliasRecord
type MyTypeChain = MyType
type MyTypeStrChain = MyTypeStr
type MyTypeArrayChain = MyTypeArray
type MyRecordChain = MyRecord

function assertNumber(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('type alias test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

function assertString(actual:string, expected:string) {
    if (actual !== expected) {
        msvcrt.printf('type alias test failed: expected %s, received %s\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

class AliasRecord {
    count: number = 12
}

let shownNumber:MyType = 0
let shownText:MyTypeStr = ''
let passedNumber:MyTypeChain = 0
let passedText:MyTypeStrChain = ''
let passedArrayValue:MyType = 0
let passedRecordCount:number = 0

prototype MyType {
    function show(value:MyType){
        shownNumber = value
        console.log(value)
    }
}

prototype MyTypeStr {
    function show(value:MyTypeStr){
        shownText = value
        console.log(value)
    }
}

prototype MyRecord {
    function show(record:MyRecord){
        console.log(record.count)
    }
}

class AliasHolder {
    value: MyType = 0
    text: MyTypeStr = ""
}

let numA: MyType = 5
let strA: MyTypeStr = "Hello"
let nums: MyTypeArrayChain = [9]
let holder: AliasHolder = {value: 7, text: "Property"}
let record: MyRecord = new AliasRecord()

function showNumber(value:MyTypeChain){
    passedNumber = value
    console.log(value)
}

function acceptText(value:MyTypeStrChain){
    passedText = value
}

function acceptArray(values:MyTypeArrayChain){
    passedArrayValue = values[0]
    values[0] = 14
}

function acceptRecord(value:MyRecordChain){
    passedRecordCount = value.count
    value.count = 20
}

let chainedNumber:MyTypeChain = numA
chainedNumber = 8
numA = chainedNumber
assertNumber(numA, 8)
showNumber(numA)
assertNumber(passedNumber, 8)

let chainedText:MyTypeStrChain = 'Start'
chainedText = 'Updated'
strA = chainedText
acceptText(strA)
assertString(strA, 'Updated')
assertString(passedText, 'Updated')

showNumber(holder.value)
assertNumber(passedNumber, 7)
nums[0] = 11
nums.push(10)
acceptArray(nums)
assertNumber(passedArrayValue, 11)
assertNumber(nums[0], 14)

holder.value.show()
assertNumber(shownNumber, 7)
holder.text.show()
assertString(shownText, 'Property')

record.count = 13
assertNumber(record.count, 13)
acceptRecord(record)
assertNumber(passedRecordCount, 13)
assertNumber(record.count, 20)
record.show()

console.log('type alias tests passed')
kernel.ExitProcess(0)