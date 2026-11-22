import type {NfaState, RegExpNode} from './types.ts'

export function compileNfa(node:RegExpNode,states:NfaState[]):{start:number,end:number}{
    const state = ()=>{
        states.push({epsilon:[],edges:[]})
        return states.length-1
    }
    const connect = (from:number,to:number)=>states[from].epsilon.push(to)
    if(node.kind==='empty'){
        const start = state()
        const end = state()
        connect(start,end)
        return {start,end}
    }
    if(node.kind==='characters'){
        const start = state()
        const end = state()
        states[start].edges.push({characters:node.characters,to:end})
        return {start,end}
    }
    if(node.kind==='sequence'){
        const parts = node.nodes.map(child=>compileNfa(child,states))
        for(let index=0;index<parts.length-1;index++){
            connect(parts[index].end,parts[index+1].start)
        }
        return {start:parts[0].start,end:parts[parts.length-1].end}
    }
    if(node.kind==='alternative'){
        const start = state()
        const end = state()
        for(const child of node.nodes){
            const part = compileNfa(child,states)
            connect(start,part.start)
            connect(part.end,end)
        }
        return {start,end}
    }
    const start = state()
    let current = start
    for(let index=0;index<node.min;index++){
        const part = compileNfa(node.node,states)
        connect(current,part.start)
        current = part.end
    }
    const end = state()
    if(node.max===Infinity){
        const loop = state()
        connect(current,loop)
        connect(loop,end)
        const part = compileNfa(node.node,states)
        connect(loop,part.start)
        connect(part.end,loop)
    }else{
        for(let index=node.min;index<node.max;index++){
            const next = state()
            const part = compileNfa(node.node,states)
            connect(current,next)
            connect(current,part.start)
            connect(part.end,next)
            current = next
        }
        connect(current,end)
    }
    return {start,end}
}
