import * as msvcrt from './system/lib/msvcrt.ts'
import * as kernel from './system/lib/kernel.ts'

function assertNumber(actual:number, expected:number) {
    if (actual !== expected) {
        msvcrt.printf('array test failed: expected %i, received %i\n', expected, actual)
        kernel.ExitProcess(1)
    }
}

const testArray:number[] = [1, 2, 3, 4, 5]

const [number1, number2, number3, number4, number5] = testArray
console.log(number1, number2, number3, number4, number5)
console.log(testArray)


const testArrayDynamic:number[] = []
testArrayDynamic[0] = 0
//testArrayDynamic[1] = 1
testArrayDynamic[2] = 2
const testArrayEmpty:number[] = []
assertNumber(testArrayEmpty.length, 0)
assertNumber(testArrayDynamic.length, 3)
assertNumber(testArrayDynamic[0], 0)
assertNumber(testArrayDynamic[2], 2)
console.log('empty array out of range:', testArrayEmpty[0])
console.log('dynamic array hole and out of range:', testArrayDynamic[1], testArrayDynamic[3])
console.log(testArrayDynamic[0], testArrayDynamic[1], testArrayDynamic[2], testArrayDynamic[3])

console.log(testArrayDynamic)

const pushedLength:number = testArrayDynamic.push(3)
assertNumber(pushedLength, 4)
assertNumber(testArrayDynamic.length, 4)
assertNumber(testArrayDynamic[3], 3)
console.log('dynamic array after push:', testArrayDynamic.length, testArrayDynamic[3], testArrayDynamic[4])

const testArrayD:number[] = []
for(let i = 0; i < 5; i++) {
    testArrayD[i] = i
}
console.log(testArrayD)



class TestClass {
    numA: number = 111
    show(value: number) {
        console.log('base class array method', this.numA, value)
    }
}

class TestDerivedClass extends TestClass {
    show(value: number) {
        console.log('derived class array method', this.numA, value)
    }
}

const arrayTest:TestClass[] = []
arrayTest[0] = new TestClass()

console.log(arrayTest[0].numA)

class TestContainer {
    items: TestClass[] = []
    add(item: TestClass) {
        this.items.push(item)
    }
    showFirst() {
        this.items[0].show(123)
    }
}

function showTestClass(item: TestClass) {
    item.show(456)
}

const testContainer:TestContainer = new TestContainer()
const arrayMethodTestItem:TestDerivedClass = new TestDerivedClass()
testContainer.add(arrayMethodTestItem)
testContainer.showFirst()
showTestClass(arrayMethodTestItem)


const arrayAny:any[] = []
arrayAny[0] = new TestClass()
arrayAny[1] = 123

console.log(arrayAny[0].numA, arrayAny[1])
arrayAny[2] = 'text'
arrayAny[3] = true
arrayAny.push(456)
arrayAny[4] = 1.5
arrayAny[5] = 789
console.log(arrayAny[0].numA, arrayAny[1], arrayAny[2], arrayAny[3], arrayAny[4], arrayAny[5])

msvcrt.printf('array tests passed\n')
kernel.ExitProcess(0)