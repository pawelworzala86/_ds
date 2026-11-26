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

function funcA(a:number,b:number=10,c:string='test',klasa:cKlasa=new cKlasa()){
    console.log(`a: ${a}, b: ${b}, c: ${c}`);
    if(klasa){
        klasa.sayHello();
    }
}
funcA(5)