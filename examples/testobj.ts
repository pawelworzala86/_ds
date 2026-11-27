import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

function assertNumber(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('object test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

function assertString(actual:string, expected:string) {
    if (actual !== expected) {
        msvcrt.printf('object test failed: expected %s, received %s\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

const constructorEvents:number[] = []
const methodEvents:number[] = []

msvcrt.printf('start\n')


class cTest {
    lastValue:number = 0
    constructor() {
        constructorEvents.push(1)
        msvcrt.printf('cTest constructor\n');
    }
    show(value:number, message:string) {
        methodEvents.push(2)
        this.lastValue = value
        msvcrt.printf('cTest show %i %s\n',value,message);
    }
    inherited() {
        msvcrt.printf('inherited cTest method\n');
    }
}
const obj:cTest = new cTest();



class cNewTest extends cTest{
    overrideCalls:number = 0
    constructor() {
        super()
        constructorEvents.push(2)
    }
    show(value:number, message:string) {
        methodEvents.push(1)
        this.overrideCalls++
        super.show(value,message)
    }
}
const objNew:cNewTest = new cNewTest();
objNew.show(123,'from child');
objNew.inherited();

assertNumber(constructorEvents.length, 3)
assertNumber(constructorEvents[0], 1)
assertNumber(constructorEvents[1], 1)
assertNumber(constructorEvents[2], 2)
assertNumber(objNew.lastValue, 123)
assertNumber(methodEvents.length, 2)
assertNumber(methodEvents[0], 1)
assertNumber(methodEvents[1], 2)
assertNumber(objNew.overrideCalls, 1)

function callShowThroughBase(item:cTest) {
    item.show(456, 'through base reference')
    assertNumber(item.lastValue, 456)
}
callShowThroughBase(objNew)
assertNumber(objNew.overrideCalls, 2)
assertNumber(methodEvents.length, 4)
assertNumber(methodEvents[2], 1)
assertNumber(methodEvents[3], 2)


const objA = {
    a: 1,
    b: 2,
    c: 3,
    active: true,
    title: 'initial'
}

function testFun(obj:any){
    console.log(obj)

    const keys: string[] = Object.keys(obj)

    for (const key of keys) {
        msvcrt.printf('%s\n', key)
    }

    assertNumber(keys.length, 5)
    assertString(keys[0], 'a')
    assertString(keys[4], 'title')
    assertNumber(obj['a'], 1)

}
testFun(objA)

objA.a = 10
objA['b'] = 20
objA.active = false
objA.title = 'updated'
console.log(objA)
assertNumber(objA.a, 10)
assertNumber(objA['b'], 20)
assertString(objA.title, 'updated')
if (objA.active !== false) {
    msvcrt.printf('object test failed: boolean property update\n')
    kernel.ExitProcess(1)
}

const { a, b } = objA
assertNumber(a, 10)
assertNumber(b, 20)

const objB = {
    a: 30,
    shared: 1,
    label: 'from B'
}
const objC = {
    b: 40,
    shared: 2,
    active: true
}
objB.a = 31
objB.label = 'changed B'
const objD = Object.assign({}, objB, objC)
assertNumber(objD['a'], 31)
assertNumber(objD.b, 40)
assertNumber(objD.shared, 2)
assertString(objD.label, 'changed B')
if (objD.active !== true) {
    msvcrt.printf('object test failed: Object.assign boolean property\n')
    kernel.ExitProcess(1)
}
const assignedKeys:string[] = Object.keys(objD)
assertString(assignedKeys[0], 'a')
assertString(assignedKeys[1], 'shared')
assertString(assignedKeys[3], 'b')

const objectArray:any[] = [{ value: 11 }, { value: 22 }]
objectArray[1].value = 23
console.log(objectArray)
assertNumber(objectArray[1].value, 23)

msvcrt.printf('object tests passed\n')





kernel.ExitProcess(0)