import fs from 'fs'
import Make from "./make.ts";
import Asm from "./asm.ts";
import CompileASM from './../../_winasm/sources/compile.ts'
import Tokenizer from './tokenizer.ts';
import Base from './elements/base.ts';
import { getFuncs, getFunction } from './elements/func.ts';



const source = fs.readFileSync('./examples/test.ts').toString()

const tokenizer = new Tokenizer(source)
const root = new Base(null)
let active = root

Make.compile(active,tokenizer)

//console.log(make.active)

const ASM:Asm = new Asm()

root.testChangeName()
for(const key of getFuncs()){
    const func = getFunction(key)
    func.name = 'X_'+func.name
}

root.asm(ASM)

const code = ASM.getASMCode()
console.log(code)

const exe = CompileASM(code)
fs.writeFileSync('./dist/test.exe',exe)