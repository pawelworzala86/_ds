import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

function assertString(actual:string, expected:string) {
    if (actual !== expected) {
        msvcrt.printf('runtime JSON test failed: expected %s, received %s\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

function verifyDynamicArgument(value:any) {
    const city:string = value.profile.city
    assertString(city, 'Gdansk')
}

let objectText:string = ' { "name" : "Ada", "profile" : { "city" : "Gdansk" }, "values" : [ 4, 9, 16 ], "enabled" : true } '
let object:any = JSON.parse(objectText)
console.log(object['name'])
const name:string = object['name']
const city:string = object.profile.city
const secondValue:number = object.values[1]
const sum:number = object.values[1] + 1
const enabled:boolean = object.enabled
let key:string = 'name'
const keyedName:string = object[key]
const serializedObject:string = JSON.stringify(object)
const serializedProfile:string = JSON.stringify(object.profile)
const serializedValues:string = JSON.stringify(object.values)
const missing:any = object.unknown
const missingString:string = JSON.stringify(missing)
verifyDynamicArgument(object)

let stringText:string = '"runtime text"'
let dynamicString:any = JSON.parse(stringText)
const parsedString:string = dynamicString

let numberText:string = '12.5'
let dynamicNumber:any = JSON.parse(numberText)
const parsedNumber:number = dynamicNumber

let booleanText:string = 'false'
let dynamicBoolean:any = JSON.parse(booleanText)
const parsedBoolean:boolean = dynamicBoolean

let nullText:string = 'null'
let dynamicNull:any = JSON.parse(nullText)
const serializedNull:string = JSON.stringify(dynamicNull)

let emptyObjectText:string = '{}'
let dynamicEmptyObject:any = JSON.parse(emptyObjectText)
const serializedEmptyObject:string = JSON.stringify(dynamicEmptyObject)

let emptyArrayText:string = '[]'
let dynamicEmptyArray:any = JSON.parse(emptyArrayText)
const serializedEmptyArray:string = JSON.stringify(dynamicEmptyArray)

let rootArrayText:string = '[1,2,"three",null,{"enabled":true}]'
let rootArray:any = JSON.parse(rootArrayText)
const rootArraySecond:number = rootArray[1]
const rootArraySerialized:string = JSON.stringify(rootArray)

let invalidText:string = '{"broken":'
let invalid:any = JSON.parse(invalidText)
const invalidString:string = JSON.stringify(invalid)

assertString(name, 'Ada')
assertString(city, 'Gdansk')
assertString(keyedName, 'Ada')
assertString(serializedObject, '{"name":"Ada","profile":{"city":"Gdansk"},"values":[4,9,16],"enabled":true}')
assertString(serializedProfile, '{"city":"Gdansk"}')
assertString(serializedValues, '[4,9,16]')
assertString(missingString, 'undefined')
assertString(parsedString, 'runtime text')
assertString(serializedNull, 'null')
assertString(serializedEmptyObject, '{}')
assertString(serializedEmptyArray, '[]')
assertString(rootArraySerialized, '[1,2,"three",null,{"enabled":true}]')
assertString(invalidString, 'undefined')

if (secondValue !== 9 || sum !== 10 || enabled !== true || parsedNumber !== 12.5 || parsedBoolean !== false
    || rootArraySecond !== 2
    || parsedString !== 'runtime text' || JSON.isValid(invalid)) {
    msvcrt.printf('runtime JSON type or validation test failed\n')
    kernel.ExitProcess(1)
}

console.log(object, object.profile, object.values, dynamicNull, invalid)
JSON.free(object)
JSON.free(dynamicString)
JSON.free(dynamicNumber)
JSON.free(dynamicBoolean)
JSON.free(dynamicNull)
JSON.free(dynamicEmptyObject)
JSON.free(dynamicEmptyArray)
JSON.free(rootArray)
JSON.free(invalid)
msvcrt.printf('runtime JSON tests passed\n')
kernel.ExitProcess(0)
