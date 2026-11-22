import DataElement, {type NumericKind} from '../elements/dataElement.ts'

export type BinaryOperator = '+'|'-'|'*'|'/'|'%'|'**'
export type MathFunctionName = 'sin'|'cos'|'tan'|'asin'|'acos'|'atan'|'atan2'|'sqrt'|'pow'|'fmod'|'exp'|'log'|'log10'|'ceil'|'floor'|'fabs'

export type Expression =
    | {kind:'number',value:string,numericKind:NumericKind}
    | {kind:'data',value:DataElement,numericKind:NumericKind}
    | {kind:'stringLength',value:DataElement,numericKind:'integer'}
    | {kind:'arrayLength',value:DataElement,numericKind:'integer'}
    | {kind:'index',value:DataElement,index:Expression,numericKind:NumericKind}
    | {kind:'unary',operator:'+'|'-',value:Expression,numericKind:NumericKind}
    | {kind:'binary',operator:BinaryOperator,left:Expression,right:Expression,numericKind:NumericKind}
    | {kind:'mathCall',name:MathFunctionName,arguments:Expression[],numericKind:'float'}
