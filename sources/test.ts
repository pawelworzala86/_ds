import fs from 'fs'
import Make from "./make.ts";
import ASM from "./asm.ts";


const source = fs.readFileSync('./examples/test.ts').toString()

const make = new Make(source)
make.compile()

make.asm()

const code = ASM.getCode()
console.log(code)