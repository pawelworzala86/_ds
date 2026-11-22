import type Call from '../call.ts'
import type DataElement from '../dataElement.ts'
import type {Expression} from '../../maths.ts'

export type StringOperand =
    | {kind:'literal',value:string}
    | {kind:'data',value:DataElement}

export type Condition =
    | {kind:'and',left:Condition,right:Condition}
    | {kind:'or',left:Condition,right:Condition}
    | {kind:'not',value:Condition}
    | {kind:'boolean',value:boolean}
    | {kind:'compare',left:Expression|StringOperand,right:Expression|StringOperand,operator:string,calls:ConditionCall[]}
    | {kind:'truthy',value:Expression,calls:ConditionCall[]}

export type ConditionCall = {call:Call,temp:DataElement}
export type ParsedOperand = {value:Expression|StringOperand,calls:ConditionCall[]}