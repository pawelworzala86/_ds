let structLayoutId = 0
let objectStringLabelId = 0
let callResultId = 0

export function nextStructLayoutId(){
    return ++structLayoutId
}

export function nextObjectStringLabelId(){
    return ++objectStringLabelId
}

export function nextCallResultId(){
    return ++callResultId
}
