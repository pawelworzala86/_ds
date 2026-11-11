import fs from 'fs'
import Make from "./make.ts";



const source = fs.readFileSync('./examples/test.ts').toString()

const make = new Make(source)
make.compile()

make.asm()