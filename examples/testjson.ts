import * as msvcrt from './system/lib/msvcrt.ts'



const text:string = '{"propA":"valueA","profile":{"enabled":true,"nickname":null,"label":"admin"},"numbers":[2,4,8],"flags":[true,false],"labels":["red","blue"],"items":[{"id":1},{"id":2}],"mixed":[1,"two",false,null,[5]]}'


let json:any = JSON.parse(text)
const serialized:string = JSON.stringify(json)
const serializedProfile:string = JSON.stringify(json.profile)
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

console.log(json.propA, json.profile.label, json.profile.enabled, json.profile.nickname, json.numbers[1], json.flags[1], json.labels[0], json.mixed[1], rootArray[1])
console.log(rootBoolean, rootNull)
msvcrt.printf(' JSON: %s ', serialized)
msvcrt.printf(' PROFILE: %s ', serializedProfile)
msvcrt.printf(' ARRAY: %s ', serializedArray)
msvcrt.printf(' MIXED: %s ', serializedMixed)
msvcrt.printf(' BOOLEAN: %s ', serializedBoolean)
msvcrt.printf(' EMPTY: %s %s ', serializedEmptyObject, serializedEmptyArray)