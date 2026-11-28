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

## HTTP

`examples/system/fetch.ts` udostępnia `fetch(url)` przez WinINet. Pobieranie jest synchroniczne i obsługuje żądanie GET; odpowiedź udostępnia tekst przez `response.text()`. `await` może poprzedzać takie synchroniczne wywołanie, ale nie czyni pobierania asynchronicznym. Odczyt odpowiedzi kończy się błędem procesu w razie niepowodzenia połączenia lub odczytu.

`examples/system/http.ts` udostępnia serwer TCP z `createServer` oraz obsługę przychodzących metod GET, POST, PUT, PATCH i DELETE. `Request` udostępnia nazwę metody w polu `method` oraz predykaty `isGet()`, `isPost()`, `isPut()`, `isPatch()` i `isDelete()` do routingu. `Response.json(object)` ustawia typ JSON i serializuje znane kompilatorowi dane obiektu podczas kompilacji, zgodnie z ograniczeniami `JSON.stringify`. Przykład serwera: `.\test.cmd testhttp`.

## Tablice typowane

Obsługiwane typy tablic typowanych to `Int8Array`, `Uint8Array`, `Uint8ClampedArray`, `Int16Array`, `Uint16Array`, `Int32Array`, `Uint32Array`, `Float32Array`, `Float64Array`, `BigInt64Array` i `BigUint64Array`. Konstruktor przyjmuje długość, literał tablicy wartości odpowiedniego typu, znaną kompilatorowi tablicę albo widok `innaTablica.buffer`; widok może dodatkowo podawać bajtowy offset i długość. Literały BigInt używają składni `n`, np. `new BigInt64Array([-1n, 2n])`. Konwersja wartości oraz bajtowa reprezentacja używają semantyki typowanych tablic JavaScript i porządku little-endian. Obsługiwane są inicjalizacja i odczyt indeksowanych elementów, np. `console.log(bytes[0])`; modyfikowanie elementów nie jest jeszcze obsługiwane. `slice()` tworzy niezależną tablicę tego samego typu, przyjmuje do dwóch indeksów całkowitych (literałów lub stałych), obsługuje indeksy ujemne liczone od końca i może być użyte jako inicjalizator tablicy typowanej.

Tablice statyczne i typowane obsługują `.length` oraz `.toString()` zwracające elementy oddzielone przecinkami; `.length` działa także dla tablic dynamicznych. `console.log` wypisuje zawartość tablic, również dynamicznych, oraz pola obiektów, zamiast ich adresów; tekstowe wartości wewnątrz tych agregatów są ujmowane w apostrofy. `ArrayBuffer` jest wbudowanym typem wskaźnikowym, a `.toString()` zwraca wskaźnik do tekstu zakończonego NUL-em. `examples/system/fs.ts` udostępnia synchroniczne odczytywanie i zapisywanie plików oraz `readdirSync(path)`, które zwraca nazwy wpisów katalogu jako `string[]`; odczyt pliku alokuje dodatkowy bajt zerujący po odczytanych danych.

## Obiekty

Literały obiektów mogą zawierać pola typu `number`, `string` i `boolean`. Obsługiwany jest odczyt oraz zapis znanych pól przez notację kropkową lub indeks z literalnym kluczem tekstowym, przekazywanie obiektu do funkcji, destrukturyzacja pól liczbowych i `Object.keys(obj)` do inicjalizacji tablicy `string[]`. `console.log(obj)` wypisuje aktualne wartości pól, a `console.log(array)` elementy tablicy; wartości tekstowe są ujmowane w apostrofy. `Object.assign({}, source1, source2)` tworzy płytką kopię pól źródeł; późniejsze źródła nadpisują wartości, a przypisanie odbywa się w czasie działania programu. Źródła muszą być zmiennymi obiektowymi z polami skalarnymi `number`, `string` lub `boolean`; dynamiczne klucze, dodawanie/usuwanie pól, prototypy, zagnieżdżone obiekty i tablice w `Object.assign` nie są obsługiwane. Przykład testowy: `.\test.cmd testobj`.

Dynamiczne tablice typów klasowych, np. `const items: MyClass[] = []`, obsługują przypisanie istniejącej instancji lub `new MyClass()` bez argumentów do indeksu, np. `items[0] = new MyClass()`. Pola `number` obiektów w tablicy można odczytywać i modyfikować przez `items[index].field`; metody elementów można też wywoływać przez tablicową właściwość klasy, np. `this.items[index].render()`.

## JSON

`JSON.parse` przyjmuje literał tekstowy albo stałą tekstową i podczas kompilacji wyznacza typ wyniku. Obsługuje wartości tekstowe, skończone liczby, wartości logiczne, `null`, obiekty zagnieżdżone i tablice. Klucze obiektów używane jako pola muszą być poprawnymi identyfikatorami języka. Mieszane i zagnieżdżone tablice można serializować, ale ich indeksowanie nie jest jeszcze ogólnie typowane.

`JSON.stringify` przyjmuje znaną kompilatorowi wartość JSON i tworzy tekst JSON podczas kompilacji, np. `const text: string = JSON.stringify(data, null, 4)`. Opcjonalny `replacer` może być `null`, `undefined` albo tablicą literałów tekstowych i liczbowych, a `space` — literałem tekstowym lub liczbowym. Nie serializuje zmian wprowadzonych do obiektu już po kompilacji.

## Parametry domyślne i interpolacja

Funkcje i metody mogą deklarować domyślne wartości parametrów; kompilator dostarcza brakujące argumenty podczas kompilacji, także dla domyślnych instancji klas, np. `function greet(name: string = 'world', item: Item = new Item())`. `console.log` obsługuje interpolację prostych wartości w literałach szablonowych, np. ``console.log(`name: ${name}`)``. Instancję klasy można sprawdzić w warunku, np. `if (item)`.

## Pozostałe możliwości języka

Przykłady pokazują również podstawowe konstrukcje sterujące i sposób pracy z funkcjami oraz klasami:

- Instrukcje warunkowe `if`/`else if`/`else` obsługują porównania liczb i tekstu, a także wyniki wywołań funkcji. Pętle `for` z licznikiem, `for...in` po tablicach (iteracja po indeksach) oraz `while` pozwalają sterować wykonaniem; dostępna jest instrukcja `break`.
- `switch` działa dla wartości liczbowych i tekstowych, z gałęziami `case` oraz `default`.
- Funkcje mogą zwracać wartości, w tym instancje klas. Klasy obsługują konstruktory, metody, dziedziczenie, `super`, dynamiczne wywoływanie nadpisanych metod przez referencje do klas bazowych oraz łańcuchowe wywołania metod zwracających `this`.
- Aliasy `type` mogą wskazywać typy proste, tablice i klasy. Deklaracje `interface` oraz literały obiektowe służą do opisywania i przekazywania struktur danych.
- Tablice zwykłe obsługują inicjalizację, dostęp przez indeks, destrukturyzację, `push` i tablice dynamiczne. Przykłady pokazują też tablice `any[]` i tablice instancji klas.
- `prototype` umożliwia definiowanie metod dla typów prostych i tablic.
- Dostępne przykłady demonstrują sprawdzanie typów przez `typeof` i `instanceof`, a także wartości logiczne w zmiennych, warunkach, polach obiektów, tablicach i parametrach funkcji.
- Obsługiwane importy pozwalają korzystać z modułów projektu, w tym opakowań funkcji systemowych Windows.

## Katalog przykładów

Każdy przykład można skompilować i uruchomić przez `.\test.cmd <nazwa>`, np. `.\test.cmd testfor`. Skrypt kompiluje `examples/<nazwa>.ts` do pliku wykonywalnego w `dist`, a następnie go uruchamia.

| Plik | Zakres demonstracji |
| --- | --- |
| `test1.ts` | Klasy, tworzenie instancji, wywołania metod, zwracanie instancji i parametry domyślne. |
| `test2.ts` | Aliasy typów prostych, tablic i klas oraz metody `prototype` dla aliasów. |
| `testarray.ts` | Tablice statyczne i dynamiczne, destrukturyzacja, `push`, `any[]` i tablice klas. |
| `testasync.ts` | Funkcja `async`, `setTimeout` i wywołania funkcji systemowych `printf`. |
| `testbuffer.ts` | Tablice typowane, konwersje wartości, widoki `ArrayBuffer` oraz `slice`. |
| `testchain.ts` | Sekwencyjne wywołania metod zwracających `this`. |
| `testfor.ts` | Pętla `for` z licznikiem i iteracja `for...in` po tablicach. |
| `testfs.ts` | Zapis, odczyt oraz listowanie katalogu tymczasowego za pomocą modułu `system/fs.ts`. |
| `testgl1.ts` | Podstawowe rysowanie trójkąta z użyciem OpenGL. |
| `testgl2.ts` | Rozszerzenie sceny OpenGL o renderowanie fontu. Przykłady graficzne wymagają odpowiednich zasobów i środowiska Windows z obsługą OpenGL. |
| `testhttp.ts` | Serwer HTTP obsługujący metody GET, POST, PUT, PATCH i DELETE oraz odpowiedzi JSON. |
| `testiff.ts` | Warunki `if`/`else if`/`else` z różnymi typami wyrażeń. |
| `testjson.ts` | Parsowanie i serializacja JSON, w tym obiektów, tablic, wartości prostych i pustych struktur. |
| `testlog.ts` | `console.log` dla argumentów prostych, tablic, obiektów i danych JSON. |
| `testmat4.ts` | Tworzenie, drukowanie, translacja i macierz perspektywy z modułu `system/gl/mat4.ts`. |
| `testobj.ts` | Klasy i dziedziczenie oraz operacje na obiektach, `Object.keys`, `Object.assign` i tablice obiektów. |
| `testpromise.ts` | Promise, callbacki `then`/`catch`, `await` oraz sukces i odrzucenie `Promise.all`. `testpromiseawaitfailure.ts` sprawdza zakończenie procesu po odrzuconym `await`. |
| `testprototype.ts` | Metody `prototype` dla liczb, tekstu i tablic oraz `push`. |
| `testregexpr.ts` | Dzielenie tekstu i zastępowanie dopasowań regexem, w tym odwołania `\k<nazwa>` do nazwanych grup o stałej zawartości literalnej. |
| `teststr.ts` | Długość, kod znaków, metody wyszukiwania, zakresy, konwersja wielkości liter, przycinanie, powtarzanie i zamiana tekstu. |
| `teststruct.ts` | Typ `interface`, literały obiektowe, odczyt pól, destrukturyzacja i przekazywanie obiektu do funkcji. |
| `testswitch.ts` | Instrukcja `switch` dla liczb i tekstu. |
| `testtype.ts` | `instanceof`, `typeof` i użycie typu `boolean`. |
| `testurl.ts` | Pobranie tekstu z URL przez systemowy moduł `fetch`. |
| `testwhile.ts` | Pętle `while`, warunek logiczny i `break`. |
