# _DS
Prosty język programowania który jest podobny do TypeScript. Projekt wykorzystuje inny mój projekt do kompilacji: _winasm. Cały skrypt przetwarza kod TS do autorkiego ASM i tworzy program z kodu.\
Aby odpalić kompilację należy wystartować np.:\
.\test.cmd testgl

## Wyrażenia regularne

`String.split` przyjmuje literały regex, np. `text.split(/\s+/g)`. `String.replace` przyjmuje tekst lub literał regex, np. `text.replace('cat', 'dog')` albo `text.replace(/cat/g, 'dog')`; bez flagi `g` zastępuje pierwsze dopasowanie, a z flagą `g` wszystkie. Zamiast tekstu zastępczego można podać funkcję przyjmującą jeden argument tekstowy (dopasowanie) i zwracającą tekst, np. `text.replace(/cat/g, replaceCat)`. Obsługiwane są znaki literalne i ucieczki, `.`, klasy znaków z zakresami i negacją, skróty `\d`, `\w`, `\s` (oraz ich wielkie odpowiedniki), grupy nieprzechwytujące `(?:...)`, alternatywa `|`, kwantyfikatory `*`, `+`, `?`, `{n}`, `{n,m}`, `{n,}` oraz flagi `g`, `i` i `s`. Pojedyncza grupa przechwytująca obejmująca cały separator, np. `text.split(/(,)/)`, dodaje separator do tablicy wynikowej.

Silnik działa na znakach ASCII i bajtach. Kotwice, inne grupy przechwytujące, lookaround, backreference, leniwe kwantyfikatory oraz wzorce dopasowujące pusty tekst nie są obsługiwane przez `String.split` ani `String.replace` i powodują błąd kompilacji.

## Operacje na tekstach

Obsługiwane metody `String` to również `indexOf`, `includes`, `startsWith` i `endsWith`; każda przyjmuje jeden argument tekstowy. `indexOf` zwraca `-1`, gdy tekst nie zostanie znaleziony, a pozostałe metody zwracają `1` lub `0`. `substring` i `slice` przyjmują indeks początkowy oraz opcjonalny końcowy; `substring` zamienia indeksy, gdy początek jest większy od końca, a `slice` obsługuje indeksy ujemne liczone od końca tekstu. `concat` dopisuje jeden argument tekstowy. Metody zwracające tekst można przypisać do zmiennej tekstowej. Porównania oraz indeksy działają na bajtach ASCII.

## Typ logiczny

Typ `boolean` obsługuje wartości `true` i `false`, przypisania, warunki, tablice oraz parametry funkcji. Wyniki metod `includes`, `startsWith` i `endsWith` można przypisać do zmiennej `boolean`.

## JSON

`JSON.parse` przyjmuje literał tekstowy albo stałą tekstową i podczas kompilacji wyznacza typ wyniku. Obsługuje wartości tekstowe, skończone liczby, wartości logiczne, `null`, obiekty zagnieżdżone i tablice. Klucze obiektów używane jako pola muszą być poprawnymi identyfikatorami języka. Mieszane i zagnieżdżone tablice można serializować, ale ich indeksowanie nie jest jeszcze ogólnie typowane.

`JSON.stringify` przyjmuje znaną kompilatorowi wartość JSON i tworzy tekst JSON podczas kompilacji, np. `const text: string = JSON.stringify(data, null, 4)`. Opcjonalny `replacer` może być `null`, `undefined` albo tablicą literałów tekstowych i liczbowych, a `space` — literałem tekstowym lub liczbowym. Nie serializuje zmian wprowadzonych do obiektu już po kompilacji.
