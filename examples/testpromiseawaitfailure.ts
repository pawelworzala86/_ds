import * as msvcrt from './system/lib/msvcrt.ts'

const rejected:Promise<number> = Promise.reject(13)
const value:number = await rejected

msvcrt.printf('rejected await unexpectedly continued with %i\n', value)
