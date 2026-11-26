type MyType = number
type MyTypeStr = string
type MyTypeArray = MyType[]
type MyRecord = AliasRecord

class AliasRecord {
    count: number = 12
}

prototype MyType {
    function show(value:MyType){
        console.log(value)
    }
}

prototype MyTypeStr {
    function show(value:MyTypeStr){
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
let nums: MyTypeArray = [9]
let holder: AliasHolder = {value: 7, text: "Property"}
let record: MyRecord = new AliasRecord()

function showNumber(value:MyType){
    console.log(value)
}

function acceptArray(values:MyTypeArray){
}

console.log(numA)
console.log(strA)
showNumber(holder.value)
nums.push(10)
acceptArray(nums)
console.log(nums[0])
holder.value.show()
holder.text.show()
record.show()