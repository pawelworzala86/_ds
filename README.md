# _DS
Prosty język programowania który jest podobny do TypeScript. Projekt wykorzystuje inny mój projekt do kompilacji: _winasm. Cały skrypt przetwarza kod TS do autorkiego ASM i tworzy program z kodu.\
Aby odpalić kompilację należy wystartować np.:\
.\test.cmd testgl1

## Wyrażenia regularne

`String.split` przyjmuje literały regex, np. `text.split(/\s+/g)`. `String.replace` przyjmuje tekst lub literał regex, np. `text.replace('cat', 'dog')` albo `text.replace(/cat/g, 'dog')`; bez flagi `g` zastępuje pierwsze dopasowanie, a z flagą `g` wszystkie. Zamiast tekstu zastępczego można podać funkcję przyjmującą jeden argument tekstowy (dopasowanie) i zwracającą tekst, np. `text.replace(/cat/g, replaceCat)`. Obsługiwane są znaki literalne i ucieczki, `.`, klasy znaków z zakresami i negacją, skróty `\d`, `\w`, `\s` (oraz ich wielkie odpowiedniki), grupy nieprzechwytujące `(?:...)`, alternatywa `|`, kwantyfikatory `*`, `+`, `?`, `{n}`, `{n,m}`, `{n,}` oraz flagi `g`, `i` i `s`. Pojedyncza grupa przechwytująca obejmująca cały separator, np. `text.split(/(,)/)`, dodaje separator do tablicy wynikowej.

Silnik działa na znakach ASCII i bajtach. Kotwice, inne grupy przechwytujące, lookaround, backreference, leniwe kwantyfikatory oraz wzorce dopasowujące pusty tekst nie są obsługiwane przez `String.split` ani `String.replace` i powodują błąd kompilacji.

## Operacje na tekstach

Obsługiwane metody `String` to również `indexOf`, `includes`, `startsWith` i `endsWith`; każda przyjmuje jeden argument tekstowy. `indexOf` zwraca `-1`, gdy tekst nie zostanie znaleziony, a pozostałe metody zwracają `1` lub `0`. `substring` i `slice` przyjmują indeks początkowy oraz opcjonalny końcowy; `substring` zamienia indeksy, gdy początek jest większy od końca, a `slice` obsługuje indeksy ujemne liczone od końca tekstu. `concat` dopisuje jeden argument tekstowy. `toUpperCase`/`toLowerCase` (oraz warianty `toLocale...`) zmieniają wielkość liter ASCII; `trim`, `trimStart` i `trimEnd` usuwają białe znaki ASCII. `repeat` przyjmuje nieujemną liczbę całkowitą. `replaceAll` zastępuje wszystkie wystąpienia tekstu, a dla regexu wymaga flagi `g`. Metody zwracające tekst można przypisać do zmiennej tekstowej. Operacje na znakach i białych znakach działają na bajtach ASCII.

## Typ logiczny

Typ `boolean` obsługuje wartości `true` i `false`, przypisania, warunki, tablice oraz parametry funkcji. Wyniki metod `includes`, `startsWith` i `endsWith` można przypisać do zmiennej `boolean`.

## Uproszczone Promise

Obsługiwane są `Promise.resolve(value)`, `Promise.reject(value)`, executor wywołujący `resolve(value)` lub `reject(value)` bezpośrednio albo w pojedynczym `setTimeout(() => { ... }, delay)`, `.then(callback)` i `.catch(callback)`. Callbacki mogą być nazwanymi funkcjami albo funkcjami strzałkowymi z blokiem; muszą przyjmować jeden argument zgodny z typem Promise. Promise może przechowywać wartości `number`, `string`, `boolean` oraz instancje klas, np. `Promise<MyClass>` z wartością `new MyClass(...)`.

`Promise.all([promise1, promise2])` przyjmuje niepustą tablicę zmiennych `Promise<T>` o tym samym typie `T` i zwraca `Promise<T[]>`. Promise wynikowy rozstrzyga się po rozstrzygnięciu wszystkich wejściowych; odrzuca się, gdy którykolwiek z nich zostanie odrzucony. Tablicę wyników można obsłużyć w callbacku `.then`, np. przez `values.forEach(value => { ... })`. `await` i callbacki `.then`/`.catch` czekają na rozstrzygnięcie Promise; odrzucenie kończy program kodem błędu. Dla klas `await` kopiuje pola instancji do zmiennej wynikowej. Nie są obsługiwane mikrozadania, inne asynchroniczne resolve/reject, domknięcia ani łańcuchy Promise. Przykład: `.\test.cmd testpromise`.

## Tablice typowane

Obsługiwane typy tablic typowanych to `Int8Array`, `Uint8Array`, `Uint8ClampedArray`, `Int16Array`, `Uint16Array`, `Int32Array`, `Uint32Array`, `Float32Array`, `Float64Array`, `BigInt64Array` i `BigUint64Array`. Konstruktor przyjmuje długość, literał tablicy wartości odpowiedniego typu, znaną kompilatorowi tablicę albo widok `innaTablica.buffer`; widok może dodatkowo podawać bajtowy offset i długość. Literały BigInt używają składni `n`, np. `new BigInt64Array([-1n, 2n])`. Konwersja wartości oraz bajtowa reprezentacja używają semantyki typowanych tablic JavaScript i porządku little-endian. Obsługiwane są inicjalizacja i odczyt indeksowanych elementów, np. `console.log(bytes[0])`; modyfikowanie elementów nie jest jeszcze obsługiwane. `slice()` tworzy niezależną tablicę tego samego typu, przyjmuje do dwóch indeksów całkowitych (literałów lub stałych), obsługuje indeksy ujemne liczone od końca i może być użyte jako inicjalizator tablicy typowanej.

Tablice statyczne i typowane obsługują `.length` oraz `.toString()` zwracające elementy oddzielone przecinkami; `.length` działa także dla tablic dynamicznych. `console.log` wypisuje zawartość tablic, również dynamicznych, oraz pola obiektów, zamiast ich adresów; tekstowe wartości wewnątrz tych agregatów są ujmowane w apostrofy. `ArrayBuffer` jest wbudowanym typem wskaźnikowym, a `.toString()` zwraca wskaźnik do tekstu zakończonego NUL-em. `examples/system/fs.ts` alokuje dodatkowy bajt zerujący po odczytanych danych.

## Obiekty

Literały obiektów mogą zawierać pola typu `number`, `string` i `boolean`. Obsługiwany jest odczyt oraz zapis znanych pól przez notację kropkową lub indeks z literalnym kluczem tekstowym, przekazywanie obiektu do funkcji, destrukturyzacja pól liczbowych i `Object.keys(obj)` do inicjalizacji tablicy `string[]`. `console.log(obj)` wypisuje aktualne wartości pól, a `console.log(array)` elementy tablicy; wartości tekstowe są ujmowane w apostrofy. `Object.assign({}, source1, source2)` tworzy płytką kopię pól źródeł; późniejsze źródła nadpisują wartości, a przypisanie odbywa się w czasie działania programu. Źródła muszą być zmiennymi obiektowymi z polami skalarnymi `number`, `string` lub `boolean`; dynamiczne klucze, dodawanie/usuwanie pól, prototypy, zagnieżdżone obiekty i tablice w `Object.assign` nie są obsługiwane. Przykład testowy: `.\test.cmd testobj`.

Dynamiczne tablice typów klasowych, np. `const items: MyClass[] = []`, obsługują przypisanie istniejącej instancji lub `new MyClass()` bez argumentów do indeksu, np. `items[0] = new MyClass()`. Pola `number` obiektów w tablicy można odczytywać i modyfikować przez `items[index].field`.

## JSON

`JSON.parse` przyjmuje literał tekstowy albo stałą tekstową i podczas kompilacji wyznacza typ wyniku. Obsługuje wartości tekstowe, skończone liczby, wartości logiczne, `null`, obiekty zagnieżdżone i tablice. Klucze obiektów używane jako pola muszą być poprawnymi identyfikatorami języka. Mieszane i zagnieżdżone tablice można serializować, ale ich indeksowanie nie jest jeszcze ogólnie typowane.

`JSON.stringify` przyjmuje znaną kompilatorowi wartość JSON i tworzy tekst JSON podczas kompilacji, np. `const text: string = JSON.stringify(data, null, 4)`. Opcjonalny `replacer` może być `null`, `undefined` albo tablicą literałów tekstowych i liczbowych, a `space` — literałem tekstowym lub liczbowym. Nie serializuje zmian wprowadzonych do obiektu już po kompilacji.

## Parametry domyślne i interpolacja

Funkcje i metody mogą deklarować domyślne wartości parametrów; kompilator dostarcza brakujące argumenty podczas kompilacji, także dla domyślnych instancji klas, np. `function greet(name: string = 'world', item: Item = new Item())`. `console.log` obsługuje interpolację prostych wartości w literałach szablonowych, np. ``console.log(`name: ${name}`)``. Instancję klasy można sprawdzić w warunku, np. `if (item)`.
