import fs from 'fs'
import Make from "./make.ts";
import Asm from "./asm.ts";
import CompileASM from './../../_winasm/sources/compile.ts'
import Tokenizer from './tokenizer.ts';
import Base from './elements/base.ts';



const source = fs.readFileSync('./examples/test.ts').toString()

const tokenizer = new Tokenizer(source)
const root = new Base(null)
//let active = root

Make.compile(root,tokenizer)

//console.log(make.active)

const ASM:Asm = new Asm()

root.testChangeName()

root.asm(ASM)

const code = ASM.getASMCode()
console.log(code)

const exe = CompileASM(code)
fs.writeFileSync('./dist/test.exe',exe)

console.log(root.FUNCTIONS)