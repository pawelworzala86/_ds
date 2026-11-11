import fs from 'fs'
import Compile from './compile.ts'
import CompileASM from './../../_winasm/sources/compile.ts'

if(!fs.existsSync('./dist/')){
  fs.mkdirSync('./dist/')
}
if(!fs.existsSync('./cache/')){
  fs.mkdirSync('./cache/')
}

let sourceFileName = process.argv[2]
let destFileName = process.argv[3]

let source = fs.readFileSync(sourceFileName).toString()

source = Compile(source)
fs.writeFileSync('./cache/compiled.asm', source);


let exe = CompileASM(source)

fs.writeFileSync(destFileName, exe);