import * as msvcrt from './system/lib/msvcrt.ts'
import * as fs from './system/fs.ts'



const buffor:number = fs.readFileSync('test.txt')

msvcrt.printf(' file: %s ', buffor)