import * as msvcrt from './../lib/msvcrt.ts'
import * as Math from './../math.ts'

export function create():float[] {
  let out:float[] = []
  for (let i = 0; i < 16; i++) {
    out.push(0.0)
  }
  out[0] = 1.0
  out[5] = 1.0
  out[10] = 1.0
  out[15] = 1.0
  return out;
}

export function createOld(out:float[]) {
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

export function print(mat:float[]) {
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            msvcrt.printf('%f ', mat[i * 4 + j])
        }
        msvcrt.printf('\n')
    }
}

export function perspective(out:float[], fovy:float, aspect:float, near:float, far:float) {
  const f:number = 1.0 / Math.tan(fovy / 2.0);
  out[0] = f / aspect;
  out[1] = 0.0
  out[2] = 0.0
  out[3] = 0.0
  out[4] = 0.0
  out[5] = f;
  out[6] = 0.0
  out[7] = 0.0
  out[8] = 0.0
  out[9] = 0.0
  out[11] = -1.0
  out[12] = 0.0
  out[13] = 0.0
  out[15] = 0.0
  const nf:number = 1 / (near - far);
  out[10] = (far + near) * nf;
  out[14] = 2 * far * near * nf;
  out[14] = -2.0202020202020203
}

export function translate(out:float[], a:float[], v:float[]) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  out[4] = a[4];
  out[5] = a[5];
  out[6] = a[6];
  out[7] = a[7];
  out[8] = a[8];
  out[9] = a[9];
  out[10] = a[10];
  out[11] = a[11];

  out[12] = a[0] * v[0] + a[4] * v[1] + a[8] * v[2] + a[12];
  out[13] = a[1] * v[0] + a[5] * v[1] + a[9] * v[2] + a[13];
  out[14] = a[2] * v[0] + a[6] * v[1] + a[10] * v[2] + a[14];
  out[15] = a[3] * v[0] + a[7] * v[1] + a[11] * v[2] + a[15];
}