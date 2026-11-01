import fs from 'fs'
import Compile from './../../_winasm/sources/compile.ts'

if(!fs.existsSync('./dist/')){
  fs.mkdirSync('./dist/')
}
if(!fs.existsSync('./cache/')){
  fs.mkdirSync('./cache/')
}

let sourceFileName = process.argv[2]
let destFileName = process.argv[3]

let source = fs.readFileSync(sourceFileName).toString()

let exe = Compile(source)

fs.writeFileSync(destFileName, exe);