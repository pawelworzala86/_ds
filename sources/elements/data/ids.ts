let structLayoutId = 0
let objectStringLabelId = 0

export function nextStructLayoutId(){
    return ++structLayoutId
}

export function nextObjectStringLabelId(){
    return ++objectStringLabelId
}
