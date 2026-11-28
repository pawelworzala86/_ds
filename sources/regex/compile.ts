import {parseRegExpLiteral} from './literal.ts'
import {RegExpParser} from './parser.ts'
import {compileNfa} from './nfa.ts'
import type {CompiledRegExp, NfaState} from './types.ts'

function unwrapWholeCapturingGroup(pattern:string):string|null{
    if(pattern[0]!=='('||pattern.startsWith('(?:')||pattern.startsWith('(?<')){
        return null
    }
    let depth = 0
    let inCharacterClass = false
    let escaped = false
    for(let index=0;index<pattern.length;index++){
        const char = pattern[index]
        if(escaped){
            escaped = false
        }else if(char==='\\'){
            escaped = true
        }else if(char==='['){
            inCharacterClass = true
        }else if(char===']'&&inCharacterClass){
            inCharacterClass = false
        }else if(!inCharacterClass&&char==='('){
            depth++
        }else if(!inCharacterClass&&char===')'){
            depth--
            if(depth===0){
                return index===pattern.length-1?pattern.slice(1,-1):null
            }
        }
    }
    return null
}

function isWholeNamedCapturingGroup(pattern:string):boolean{
    if(!pattern.startsWith('(?<')){
        return false
    }
    const nameEnd = pattern.indexOf('>',3)
    if(nameEnd<0||! /^[A-Za-z_$][\w$]*$/.test(pattern.slice(3,nameEnd))){
        return false
    }
    let depth = 1
    let inCharacterClass = false
    let escaped = false
    for(let index=nameEnd+1;index<pattern.length;index++){
        const char = pattern[index]
        if(escaped){
            escaped = false
        }else if(char==='\\'){
            escaped = true
        }else if(char==='['){
            inCharacterClass = true
        }else if(char===']'&&inCharacterClass){
            inCharacterClass = false
        }else if(!inCharacterClass&&char==='('){
            depth++
        }else if(!inCharacterClass&&char===')'){
            depth--
            if(depth===0){
                return index===pattern.length-1
            }
        }
    }
    return false
}

export function compileRegExpLiteral(literal:string):CompiledRegExp{
    const regexp = parseRegExpLiteral(literal)
    if(!regexp){
        throw new Error('Invalid regular expression literal')
    }
    if(/[duvy]/.test(regexp.flags)){
        throw new Error(`Regular expression flags "${regexp.flags}" are not supported by String.split or String.replace`)
    }
    const capturedPattern = unwrapWholeCapturingGroup(regexp.pattern)
    const ast = new RegExpParser(capturedPattern??regexp.pattern,regexp.flags).parse()
    const capturesWholeSeparator = capturedPattern!==null||isWholeNamedCapturingGroup(regexp.pattern)
    const states:NfaState[] = []
    const nfa = compileNfa(ast,states)
    if(states.length>4096){
        throw new Error('Regular expression is too complex for String.split or String.replace')
    }
    const closure = (initial:number[])=>{
        const result = new Set(initial)
        const pending = [...initial]
        while(pending.length){
            const current = pending.pop()!
            for(const next of states[current].epsilon){
                if(!result.has(next)){
                    result.add(next)
                    pending.push(next)
                }
            }
        }
        return result
    }
    const subsets:Set<number>[] = [new Set()]
    const subsetIds = new Map<string,number>()
    const transitions:number[][] = [Array(256).fill(0)]
    const acceptingStates:number[] = []
    const initial = closure([nfa.start])
    subsets.push(initial)
    subsetIds.set([...initial].sort((a,b)=>a-b).join(','),1)
    for(let index=1;index<subsets.length;index++){
        if(index>255){
            throw new Error('Regular expression has too many states for String.split or String.replace')
        }
        const subset = subsets[index]
        const row = Array(256).fill(0)
        if(subset.has(nfa.end)){
            acceptingStates.push(index)
        }
        for(let character=0;character<256;character++){
            const destinations = new Set<number>()
            for(const state of subset){
                for(const edge of states[state].edges){
                    if(edge.characters.has(character)){
                        destinations.add(edge.to)
                    }
                }
            }
            if(!destinations.size){
                continue
            }
            const destination = closure([...destinations])
            const key = [...destination].sort((a,b)=>a-b).join(',')
            let target = subsetIds.get(key)
            if(target===undefined){
                target = subsets.length
                if(target>255){
                    throw new Error('Regular expression has too many states for String.split or String.replace')
                }
                subsetIds.set(key,target)
                subsets.push(destination)
            }
            row[character] = target
        }
        transitions.push(row)
    }
    if(acceptingStates.includes(1)){
        throw new Error('Regular expressions that can match an empty string are not supported by String.split or String.replace')
    }
    return {transitions,acceptingStates,capturesWholeSeparator}
}
