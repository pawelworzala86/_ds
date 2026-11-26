const testArray:number[] = [1, 2, 3, 4, 5]

const [number1, number2, number3, number4, number5] = testArray
console.log(number1, number2, number3, number4, number5)
console.log(testArray)


const testArrayDynamic:number[] = []
testArrayDynamic[0] = 0
//testArrayDynamic[1] = 1
testArrayDynamic[2] = 2
console.log(testArrayDynamic[0], testArrayDynamic[1], testArrayDynamic[2], testArrayDynamic[3])

console.log(testArrayDynamic)

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