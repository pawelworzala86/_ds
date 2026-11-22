let ifId = 0

export function nextLabel(prefix:string){
    return `__ds_if_${prefix}_${++ifId}`
}
