import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'
import Asm from "./../asm.ts"
import fs from 'fs'
import Make from '../make.ts'

export class Export extends Base{
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        let tokens:string[] = []
        let token:any
        let index:number = 0
        index = tokenizer.index
        while(!['\n'].includes(token = tokenizer.get())){
            //console.log('REC::', token)
            tokens.push(token)
        }
        tokenizer.index = index+1
        const name = tokens[2]
        console.log('EXPORT::::::::::',name)
        this.parent!.addExport(name)
    }
    /*asm(ASM:Asm){
        console.log('IMPORT')
    }*/
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(['export'].includes(token)){
            tokenizer.move(-1)
            const data = new Export(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Export