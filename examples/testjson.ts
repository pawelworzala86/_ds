import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'



const text:string = '{"propA":"valueA","profile":{"enabled":true,"nickname":null,"label":"admin"},"numbers":[2,4,8],"flags":[true,false],"labels":["red","blue"],"items":[{"id":1},{"id":2}],"mixed":[1,"two",false,null,[5]]}'


let json:any = JSON.parse(text)
const serialized:string = JSON.stringify(json,null,4)
const serializedFiltered:string = JSON.stringify(json,['propA','numbers'],2)
const serializedNumericReplacer:string = JSON.stringify(json,[1,2],2)
const serializedTextReplacer:string = JSON.stringify(json,['profile','enabled','nickname','label'],2)
const serializedMixedReplacer:string = JSON.stringify(json,[1,'profile','numbers','enabled','nickname','label'],2)
const serializedProfile:string = JSON.stringify(json.profile)
const serializedNumericSpace:string = JSON.stringify(json.profile,null,2)
const serializedStringSpace:string = JSON.stringify(json.profile,null,'  ')
const serializedCompactProfile:string = JSON.stringify(json.profile,null,0)
let rootArray:any = JSON.parse('[1,2,3]')
const serializedArray:string = JSON.stringify(rootArray)
const serializedMixed:string = JSON.stringify(json.mixed)
let rootBoolean:any = JSON.parse('true')
let rootNull:any = JSON.parse('null')
const serializedBoolean:string = JSON.stringify(rootBoolean)
let emptyObject:any = JSON.parse('{}')
let emptyArray:any = JSON.parse('[]')
const serializedEmptyObject:string = JSON.stringify(emptyObject)
const serializedEmptyArray:string = JSON.stringify(emptyArray)

function assertString(actual:string, expected:string) {
    if (actual !== expected) {
        msvcrt.printf('json test failed: expected %s, received %s\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

assertString(serializedFiltered, '{\n  "propA": "valueA",\n  "numbers": [\n    2,\n    4,\n    8\n  ]\n}')
assertString(serializedNumericReplacer, '{}')
assertString(serializedTextReplacer, '{\n  "profile": {\n    "enabled": true,\n    "nickname": null,\n    "label": "admin"\n  }\n}')
assertString(serializedMixedReplacer, '{\n  "profile": {\n    "enabled": true,\n    "nickname": null,\n    "label": "admin"\n  },\n  "numbers": [\n    2,\n    4,\n    8\n  ]\n}')
assertString(serializedNumericSpace, '{\n  "enabled": true,\n  "nickname": null,\n  "label": "admin"\n}')
assertString(serializedStringSpace, '{\n  "enabled": true,\n  "nickname": null,\n  "label": "admin"\n}')
assertString(serializedCompactProfile, '{"enabled":true,"nickname":null,"label":"admin"}')

console.log(json.propA, json.profile.label, json.profile.enabled, json.profile.nickname, json.numbers[1], json.flags[1], json.labels[0], json.mixed[1], rootArray[1])
console.log(rootBoolean, rootNull)
msvcrt.printf(' JSON: %s ', serialized)
msvcrt.printf(' FILTERED: %s ', serializedFiltered)
msvcrt.printf(' PROFILE: %s ', serializedProfile)
msvcrt.printf(' ARRAY: %s ', serializedArray)
msvcrt.printf(' MIXED: %s ', serializedMixed)
msvcrt.printf(' BOOLEAN: %s ', serializedBoolean)
msvcrt.printf(' EMPTY: %s %s ', serializedEmptyObject, serializedEmptyArray)

msvcrt.printf('json tests passed\n')
kernel.ExitProcess(0)