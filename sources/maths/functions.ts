import type {MathFunctionName} from './types.ts'

const mathFunctions:MathFunctionName[] = ['sin','cos','tan','asin','acos','atan','atan2','sqrt','pow','fmod','exp','log','log10','ceil','floor','fabs']

export function isMathFunction(name:string):name is MathFunctionName{
    return mathFunctions.includes(name as MathFunctionName)
}
