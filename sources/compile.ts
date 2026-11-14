import fs from 'fs'
import Make from "./make.ts";
import Asm from "./asm.ts";
import CompileASM from './../../_winasm/sources/compile.ts'
import Tokenizer from './tokenizer.ts';
import Base from './elements/base.ts';


const sourceFile = process.argv[2]
const targetFile = process.argv[3]


const source = fs.readFileSync(sourceFile).toString()+'\n'

const tokenizer = new Tokenizer(source)
const root = new Base(null)

Make.compile(root,tokenizer,sourceFile)


const ASM:Asm = new Asm()

root.testChangeName()

root.asm(ASM)

const code = ASM.getASMCode()
console.log(code)

const exe = CompileASM(code)
fs.writeFileSync(targetFile,exe)