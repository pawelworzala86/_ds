import Tokenizer from '../tokenizer.ts'
import Base from './base.ts'

export class Export extends Base{
    constructor(parent:Base){
        super(parent)
    }
    set(tokenizer:Tokenizer){
        let tokens:string[] = []
        let token:any
        let index:number = 0
        index = tokenizer.index
        while(!['\n'].includes(token = tokenizer.get())){
            tokens.push(token)
        }
        tokenizer.index = tokens[1]==='default'
            ? tokens[2]==='class'||tokens[2]==='function'?index+2:index+tokens.length+1
            : index+1
        let name:string|null = null
        let kind:'data'|'function'|'class' = 'data'
        if(tokens[1]==='default'){
            if(tokens[2]==='class'){
                name = tokens[3]
                kind = 'class'
            }else if(tokens[2]==='function'){
                name = tokens[3]
                kind = 'function'
            }else{
                name = tokens[2]
                const target = name?this.parent?.getClass(name):null
                const func = name?this.parent?.getFunction(name):null
                const data = name?this.parent?.getData(name):null
                if(target){
                    kind = 'class'
                }else if(func){
                    kind = 'function'
                }else if(!data){
                    throw new Error('Unsupported default export')
                }
            }
        }else if(['let','var','const'].includes(tokens[1])){
            name = tokens[2]
        }else if(['function'].includes(tokens[1])){
            name = tokens[2]
            kind = 'function'
        }else if(tokens[1]==='class'){
            name = tokens[2]
            kind = 'class'
        }else if(tokens[1]==='interface'){
            name = tokens[2]
            kind = 'class'
        }else if(['declare'].includes(tokens[1])){
            if(tokens[2]=='function'){
                name = tokens[3]
                kind = 'function'
            }
        }
        if(!name){
            throw new Error('Unsupported export declaration')
        }
        this.parent!.addExport(tokens[1]==='default'?'default':name,kind,name)
    }
    static test(active:Base,tokenizer:Tokenizer){
        const token = tokenizer.get()
        if(['export'].includes(token)){
            tokenizer.move(-1)
            const data = new Export(active)
            data.set(tokenizer)
            active.children.push(data)
            return data
        }
        tokenizer.move(-1)
        return null
    }
}

export default Export