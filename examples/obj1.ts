import * as msvcrt from './system/msvcrt.ts'

export class TESTOBJ{
    propA:number = 123
    propB:string = 'a1b2c3'
    propC:number[] = [8,8,8]
    show(pA:number){
        msvcrt.printf('%i %i ',this.propA,pA)
    }
}