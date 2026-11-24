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