import * as msvcrt from './system/msvcrt.ts'

export class tOBJ{
    propA:number = 45
    propB:string = 'a1b2c3'
    propC:number[] = [8,8,8]
}

export class TESTOBJ{
    propA:number = 123
    propB:string = 'a1b2c3'
    propC:number[] = [8,8,8]
    obj:tOBJ = new tOBJ()
    show(pA:number){
        msvcrt.printf('%i %i ',this.propA,pA)
    }
}