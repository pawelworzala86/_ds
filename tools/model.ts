import fs from 'fs'

let vertices:number[] = [1.0,1.0,0.0,1.0,-1.0,0.0,-1.0,-1.0,0.0,1.0,1.0,0.0,-1.0,-1.0,0.0,-1.0,1.0,0.0]
let coords:number[] = [1.0,1.0,1.0,0.0,0.0,0.0,1.0,1.0,0.0,0.0,0.0,1.0]

let textureFileName:string = 'texture.jpg'



const uint8:number[] = []

function pushU64(arr:number[]) {
    const arr32 = new BigUint64Array(arr.map(v => BigInt(v)))
    const arr8 = new Uint8Array(arr32.buffer)
    arr8.forEach(v => uint8.push(v))
}
function pushF64(arr:number[]) {
    const arr32 = new Float64Array(arr)
    const arr8 = new Uint8Array(arr32.buffer)
    arr8.forEach(v => uint8.push(v))
}

pushU64([vertices.length])
pushF64(vertices)
pushU64([coords.length])
pushF64(coords)

fs.writeFileSync('./dist/model.bin', new Uint8Array(uint8))