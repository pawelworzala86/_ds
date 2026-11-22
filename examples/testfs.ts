import * as msvcrt from './system/lib/msvcrt.ts'
import * as fs from './system/fs.ts'



const buffor:string = fs.readFileSync('test.txt').toString()

msvcrt.printf(' file: %s ', buffor)


const buffor2:string = 'Hello, World!'
fs.writeFileSync('write.txt', buffor2)