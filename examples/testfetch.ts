import fetch from './system/fetch.ts'
import * as kernel from './system/lib/kernel.ts'

const url: string = 'https://www.google.com/'

const promise = await fetch(url)
const responseText = await promise.text()

console.log(responseText)

kernel.ExitProcess(0)