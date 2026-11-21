# _DS
Prosty język programowania który jest podobny do TypeScript. Projekt wykorzystuje inny mój projekt do kompilacji: _winasm. Cały skrypt przetwarza kod TS do autorkiego ASM i tworzy program z kodu.\
Aby odpalić kompilację należy wystartować np.:\
.\test.cmd testgl

## Wyrażenia regularne

`String.split` przyjmuje literały regex, np. `text.split(/\s+/g)`. `String.replace` przyjmuje tekst lub literał regex, np. `text.replace('cat', 'dog')` albo `text.replace(/cat/g, 'dog')`; bez flagi `g` zastępuje pierwsze dopasowanie, a z flagą `g` wszystkie. Obsługiwane są znaki literalne i ucieczki, `.`, klasy znaków z zakresami i negacją, skróty `\d`, `\w`, `\s` (oraz ich wielkie odpowiedniki), grupy nieprzechwytujące `(?:...)`, alternatywa `|`, kwantyfikatory `*`, `+`, `?`, `{n}`, `{n,m}`, `{n,}` oraz flagi `g`, `i` i `s`. Pojedyncza grupa przechwytująca obejmująca cały separator, np. `text.split(/(,)/)`, dodaje separator do tablicy wynikowej.

Silnik działa na znakach ASCII i bajtach. Kotwice, inne grupy przechwytujące, lookaround, backreference, leniwe kwantyfikatory oraz wzorce dopasowujące pusty tekst nie są obsługiwane przez `String.split` ani `String.replace` i powodują błąd kompilacji.
