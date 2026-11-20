import * as msvcrt from './../lib/msvcrt.ts'

export function createOld() {
  let out:number[] = []
  for (let i = 0; i < 16; i++) {
    out.push(0.0)
  }
  out[0] = 1.0
  out[5] = 1.0
  out[10] = 1.0
  out[15] = 1.0
  return out;
}

export function create(out:number[]) {
    out.push(1.0)
    out.push(0.0)
    out.push(0.0)
    out.push(0.0)
    out.push(0.0)
    out.push(1.0)
    out.push(0.0)
    out.push(0.0)
    out.push(0.0)
    out.push(0.0)
    out.push(1.0)
    out.push(0.0)
    out.push(0.0)
    out.push(0.0)
    out.push(0.0)
    out.push(1.0)
}

export function print(mat:number[]) {
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            msvcrt.printf('%f ', mat[i * 4 + j])
        }
        msvcrt.printf('\n')
    }
}