export function Compile(source: string):string{

    function r(regex: RegExp, replacement: any): void {
        source = source.replace(regex, replacement)
    }

    r(/test/gm, 'test')

    return source
}

export default Compile