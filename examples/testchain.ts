class testClass{
    constructor(){
        console.log("testClass instance created")
    }
    testMethod(){
        console.log("testMethod called")
        return this
    }
    anotherMethod(){
        console.log("anotherMethod called")
        return this
    }
    yetAnotherMethod(){
        console.log("yetAnotherMethod called")
        return this
    }
}
const instance = new testClass()
instance.testMethod()
    .anotherMethod()
    .yetAnotherMethod()