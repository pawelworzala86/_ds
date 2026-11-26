import * as kernel from './../../lib/kernel.ts'

export class GUIElement {
    children: GUIElement[] = []
    addChild(child: GUIElement) {
        //console.log('add child:', child)
        //kernel.ExitProcess(0)
        this.children.push(child)
    }
    render(perspective: number[], camera: number[], model: number[], textureID: number) {
        for(const child of this.children){
            console.log('Rendering child:', child)
            child.render(perspective, camera, model, textureID)
        }
    }
}

export default GUIElement