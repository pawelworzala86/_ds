import type {CharacterSet, RegExpNode} from './types.ts'

export class RegExpParser{
    private index = 0
    private readonly pattern:string
    private readonly flags:string
    constructor(pattern:string,flags:string){
        this.pattern = pattern
        this.flags = flags
    }

    parse():RegExpNode{
        const node = this.parseAlternative()
        if(this.index!==this.pattern.length){
            throw new Error(`Unexpected regular expression token "${this.pattern[this.index]}"`)
        }
        return node
    }

    private parseAlternative():RegExpNode{
        const nodes = [this.parseSequence()]
        while(this.peek()==='|'){
            this.index++
            nodes.push(this.parseSequence())
        }
        return nodes.length===1?nodes[0]:{kind:'alternative',nodes}
    }

    private parseSequence():RegExpNode{
        const nodes:RegExpNode[] = []
        while(this.index<this.pattern.length&&this.peek()!==')'&&this.peek()!=='|'){
            const atom = this.parseAtom()
            const quantifier = this.parseQuantifier()
            nodes.push(quantifier?{kind:'repeat',node:atom,min:quantifier.min,max:quantifier.max}:atom)
        }
        if(nodes.length===0){
            return {kind:'empty'}
        }
        return nodes.length===1?nodes[0]:{kind:'sequence',nodes}
    }

    private parseAtom():RegExpNode{
        const char = this.pattern[this.index++]
        if(char==='('){
            if(this.peek()==='?'){
                this.index++
                if(this.pattern[this.index++]!==':'){
                    throw new Error('Lookaround and special regular expression groups are not supported')
                }
            }else{
                throw new Error('Capturing groups are not supported by String.split or String.replace; use (?:...) for grouping')
            }
            const node = this.parseAlternative()
            if(this.pattern[this.index++]!==')'){
                throw new Error('Unterminated regular expression group')
            }
            return node
        }
        if(char==='['){
            return {kind:'characters',characters:this.parseCharacterClass()}
        }
        if(char==='\\'){
            return {kind:'characters',characters:this.normalizeCharacters(this.parseEscape(false).characters)}
        }
        if(char==='.'){
            const characters = this.allCharacters()
            if(!this.flags.includes('s')){
                characters.delete(10)
                characters.delete(13)
            }
            return {kind:'characters',characters}
        }
        if(char==='^'||char==='$'){
            throw new Error('Regular expression anchors are not supported by String.split or String.replace')
        }
        if(char===')'||char==='*'||char==='+'||char==='?'||char==='{'){
            throw new Error(`Unexpected regular expression token "${char}"`)
        }
        const code = char.charCodeAt(0)
        if(code>255){
            throw new Error('Regular expressions for String.split and String.replace support ASCII and byte characters only')
        }
        return {kind:'characters',characters:this.normalizeCharacters(new Set([code]))}
    }

    private parseQuantifier():{min:number,max:number}|null{
        const char = this.peek()
        let quantifier:{min:number,max:number}|null = null
        if(char==='*'){
            quantifier = {min:0,max:Infinity}
            this.index++
        }else if(char==='+'){
            quantifier = {min:1,max:Infinity}
            this.index++
        }else if(char==='?'){
            quantifier = {min:0,max:1}
            this.index++
        }else if(char==='{'){
            const match = this.pattern.slice(this.index).match(/^\{(\d+)(?:,(\d*)?)?\}/)
            if(!match){
                throw new Error('Invalid regular expression quantifier')
            }
            const min = Number(match[1])
            const max = match[2]===undefined
                ? min
                : match[2]===''?Infinity:Number(match[2])
            if(min>100||max>100||max<min){
                throw new Error('Regular expression quantifier bounds must be ordered and no greater than 100')
            }
            quantifier = {min,max}
            this.index += match[0].length
        }
        if(quantifier&&this.peek()==='?'){
            throw new Error('Lazy regular expression quantifiers are not supported by String.split or String.replace')
        }
        return quantifier
    }

    private parseCharacterClass():CharacterSet{
        const negate = this.peek()==='^'
        if(negate){
            this.index++
        }
        const characters = new Set<number>()
        let hasCharacter = false
        while(this.index<this.pattern.length&&!(this.peek()===']'&&hasCharacter)){
            const first = this.parseClassCharacter()
            hasCharacter = true
            if(this.peek()==='-'&&this.pattern[this.index+1]!==']'){
                this.index++
                const last = this.parseClassCharacter()
                if(first.size!==1||last.size!==1){
                    throw new Error('Character class ranges must use single characters')
                }
                const start = first.values().next().value as number
                const end = last.values().next().value as number
                if(end<start){
                    throw new Error('Character class range end precedes its start')
                }
                for(let code=start;code<=end;code++){
                    characters.add(code)
                }
            }else{
                for(const code of first){
                    characters.add(code)
                }
            }
        }
        if(this.pattern[this.index++]!==']'||!hasCharacter){
            throw new Error('Unterminated or empty regular expression character class')
        }
        const normalized = this.normalizeCharacters(characters)
        if(!negate){
            return normalized
        }
        const negated = this.allCharacters()
        for(const code of normalized){
            negated.delete(code)
        }
        return negated
    }

    private parseClassCharacter():CharacterSet{
        const char = this.pattern[this.index++]
        if(char===undefined){
            throw new Error('Unterminated regular expression character class')
        }
        if(char==='\\'){
            return this.parseEscape(true).characters
        }
        const code = char.charCodeAt(0)
        if(code>255){
            throw new Error('Regular expressions for String.split and String.replace support ASCII and byte characters only')
        }
        return new Set([code])
    }

    private parseEscape(inClass:boolean):{characters:CharacterSet}{
        const escaped = this.pattern[this.index++]
        if(escaped===undefined){
            throw new Error('Unterminated escape sequence in regular expression')
        }
        const shorthands:Record<string,(characters:CharacterSet)=>void>={
            d:characters=>{for(let code=48;code<=57;code++) characters.add(code)},
            w:characters=>{
                for(let code=48;code<=57;code++) characters.add(code)
                for(let code=65;code<=90;code++) characters.add(code)
                for(let code=97;code<=122;code++) characters.add(code)
                characters.add(95)
            },
            s:characters=>[9,10,11,12,13,32].forEach(code=>characters.add(code))
        }
        const lower = escaped.toLowerCase()
        if(lower==='d'||lower==='w'||lower==='s'){
            const characters = new Set<number>()
            shorthands[lower](characters)
            return {characters:escaped===lower?characters:this.complement(characters)}
        }
        const controls:Record<string,number>={n:10,r:13,t:9,v:11,f:12}
        let code:number
        if(escaped==='0'){
            code = 0
        }else if(escaped==='b'&&inClass){
            code = 8
        }else if(Object.hasOwn(controls,escaped)){
            code = controls[escaped]
        }else if(escaped==='x'){
            code = this.readHex(2)
        }else if(escaped==='u'){
            code = this.readHex(4)
        }else if(/[a-z0-9]/i.test(escaped)){
            throw new Error(`Regular expression escape "\\${escaped}" is not supported by String.split or String.replace`)
        }else{
            code = escaped.charCodeAt(0)
        }
        if(code>255){
            throw new Error('Regular expressions for String.split and String.replace support ASCII and byte characters only')
        }
        return {characters:new Set([code])}
    }

    private readHex(length:number){
        const hex = this.pattern.slice(this.index,this.index+length)
        if(!new RegExp(`^[\\da-f]{${length}}$`,'i').test(hex)){
            throw new Error('Invalid hexadecimal escape in regular expression')
        }
        this.index += length
        return parseInt(hex,16)
    }

    private normalizeCharacters(characters:CharacterSet){
        const normalized = new Set(characters)
        if(this.flags.includes('i')){
            for(const code of characters){
                if(code>=65&&code<=90){
                    normalized.add(code+32)
                }else if(code>=97&&code<=122){
                    normalized.add(code-32)
                }
            }
        }
        return normalized
    }

    private complement(characters:CharacterSet){
        const result = this.allCharacters()
        for(const code of characters){
            result.delete(code)
        }
        return result
    }

    private allCharacters(){
        return new Set(Array.from({length:256},(_,code)=>code))
    }

    private peek(){
        return this.pattern[this.index]
    }
}
