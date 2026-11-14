import fs from 'fs'
import Make from "./make.ts";
import Asm from "./asm.ts";
import CompileASM from './../../_winasm/sources/compile.ts'
import Tokenizer from './tokenizer.ts';
import Base from './elements/base.ts';
import TypePrototypeRegistry from './elements/typePrototype.ts'


const sourceFile = process.argv[2]
const targetFile = process.argv[3]


const source = fs.readFileSync(sourceFile).toString()+'\n'

const tokenizer = new Tokenizer(source)
const root = new Base(null)
TypePrototypeRegistry.reset()

const ASM:Asm = new Asm()

Make.compile(ASM,root,tokenizer,sourceFile)



root.testChangeName()

root.asm(ASM)

const code = ASM.getASMCode()
console.log(code)

const exe = CompileASM(code)
fs.writeFileSync(targetFile,exe)