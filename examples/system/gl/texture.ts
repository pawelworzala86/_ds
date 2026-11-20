import * as msvcrt from './../lib/msvcrt.ts'
import * as freeimage from './../lib/freeimage.ts'
import * as gl from './gl.ts'

let hDib:number = 0
let hDib32:number = 0
let wFormat:number = 0
let dwWidth:number = 0
let dwHeight:number = 0
let lpBits:number = 0

let textureID:number = 0

const NULL:number = 0

export function LoadTexture(name:string){

    //lea rax, name
    //msvcrt.printf(' txname=%s ', [name])

    wFormat = freeimage.FreeImage_GetFileType(name, 0)
   
    hDib = freeimage.FreeImage_Load(wFormat, name, 0)

    hDib32 = freeimage.FreeImage_ConvertTo32Bits(hDib)

    msvcrt.printf(' aaa ')

    lpBits = freeimage.FreeImage_GetBits(hDib32, NULL, 0)
  

    dwWidth = freeimage.FreeImage_GetWidth(hDib32)
    
    dwHeight = freeimage.FreeImage_GetHeight(hDib32)
    

    freeimage.FreeImage_Unload(hDib)

    msvcrt.printf(' bbb ')

    gl.genTextures(1, &textureID)
    gl.bindTexture(gl.TEXTURE_2D, textureID)

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);


    gl.texImage2D(gl.TEXTURE_2D, 0, gl.BGRA_EXT, dwWidth, dwHeight, 0, gl.BGRA_EXT, gl.UNSIGNED_BYTE, lpBits)


    msvcrt.printf(' %i ', textureID)

    return textureID
}