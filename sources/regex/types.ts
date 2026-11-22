export interface RegExpLiteral{
    pattern:string
    flags:string
}

export interface CompiledRegExp{
    transitions:number[][]
    acceptingStates:number[]
    capturesWholeSeparator:boolean
}

export type CharacterSet = Set<number>
export type RegExpNode =
    | {kind:'empty'}
    | {kind:'characters',characters:CharacterSet}
    | {kind:'sequence',nodes:RegExpNode[]}
    | {kind:'alternative',nodes:RegExpNode[]}
    | {kind:'repeat',node:RegExpNode,min:number,max:number}

export interface NfaState{
    epsilon:number[]
    edges:{characters:CharacterSet,to:number}[]
}
