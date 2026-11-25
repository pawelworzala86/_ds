class cKlasa{
    constructor(){
        console.log("cKlasa instance created");
    }
    sayHello(){
        console.log("Hello from cKlasa");
    }
}

function testFunction(){
    const instance = new cKlasa();
    instance.sayHello();
    return instance;
}
testFunction().sayHello()