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

## Uproszczone Promise

Obsługiwane są `Promise.resolve(value)`, `Promise.reject(value)`, executor wywołujący `resolve(value)` lub `reject(value)` bezpośrednio albo w pojedynczym `setTimeout(() => { ... }, delay)`, `.then(namedFunction)` i `.catch(namedFunction)`. Promise może przechowywać wartości `number`, `string`, `boolean` oraz instancje klas, np. `Promise<MyClass>` z wartością `new MyClass(...)`; typ argumentu callbacka musi odpowiadać typowi Promise. `await` i callbacki `.then`/`.catch` czekają na rozstrzygnięcie Promise; odrzucenie kończy program kodem błędu. Dla klas `await` kopiuje pola instancji do zmiennej wynikowej. Nie są obsługiwane mikrozadania, inne asynchroniczne resolve/reject, funkcje strzałkowe jako callbacki `.then`/`.catch`, domknięcia ani łańcuchy Promise.

## Tablice typowane

Obsługiwane typy tablic typowanych to `Int8Array`, `Uint8Array`, `Uint8ClampedArray`, `Int16Array`, `Uint16Array`, `Int32Array`, `Uint32Array`, `Float32Array`, `Float64Array`, `BigInt64Array` i `BigUint64Array`. Konstruktor przyjmuje długość, literał tablicy wartości odpowiedniego typu, znaną kompilatorowi tablicę albo widok `innaTablica.buffer`; widok może dodatkowo podawać bajtowy offset i długość. Literały BigInt używają składni `n`, np. `new BigInt64Array([-1n, 2n])`. Konwersja wartości oraz bajtowa reprezentacja używają semantyki typowanych tablic JavaScript i porządku little-endian. Obsługiwane są inicjalizacja i odczyt indeksowanych elementów, np. `console.log(bytes[0])`; modyfikowanie elementów nie jest jeszcze obsługiwane.

Tablice statyczne i typowane obsługują `.length` oraz `.toString()` zwracające elementy oddzielone przecinkami; `.length` działa także dla tablic dynamicznych. `ArrayBuffer` jest wbudowanym typem wskaźnikowym, a `.toString()` zwraca wskaźnik do tekstu zakończonego NUL-em. `examples/system/fs.ts` alokuje dodatkowy bajt zerujący po odczytanych danych.

## JSON

`JSON.parse` przyjmuje literał tekstowy albo stałą tekstową i podczas kompilacji wyznacza typ wyniku. Obsługuje wartości tekstowe, skończone liczby, wartości logiczne, `null`, obiekty zagnieżdżone i tablice. Klucze obiektów używane jako pola muszą być poprawnymi identyfikatorami języka. Mieszane i zagnieżdżone tablice można serializować, ale ich indeksowanie nie jest jeszcze ogólnie typowane.

`JSON.stringify` przyjmuje znaną kompilatorowi wartość JSON i tworzy tekst JSON podczas kompilacji, np. `const text: string = JSON.stringify(data, null, 4)`. Opcjonalny `replacer` może być `null`, `undefined` albo tablicą literałów tekstowych i liczbowych, a `space` — literałem tekstowym lub liczbowym. Nie serializuje zmian wprowadzonych do obiektu już po kompilacji.
