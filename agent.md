# Zadanie: dynamiczne `req.query` i `req.body` w HTTP

## Cel

Rozszerz kompilator _DS i serwer w `examples/system/http.ts`, aby callback serwera mógł korzystać z danych żądania w stylu Node.js:

- `req.query` jest obiektem z wartościami parametrów URL.
- `req.body` jest tekstem dla zwykłego body, a dla JSON-u jest sparsowaną, dynamiczną wartością JSON.
- Dostęp do dynamicznych pól, zagnieżdżonych obiektów i elementów tablic ma działać bez znajomości schematu w czasie kompilacji.
- Zachowaj istniejące zachowanie `JSON.parse` i `JSON.stringify` dla wartości znanych w czasie kompilacji.

Przykładowy cel użycia:

```ts
function requestCallback(req: httpTypes.Request, res: httpTypes.Response) {
    const user = req.query.user

    if (req.isPost()) {
        const name = req.body.profile.name
        console.log(user, name)
    }
}
```

Wartości JSON powinny zachowywać typ: tekst, liczba, boolean, `null`, obiekt lub tablica. Nie sprowadzaj wszystkich wartości JSON do tekstu.

## Etap 1 — zaprojektuj i dodaj dynamiczną reprezentację JSON

1. Przejrzyj istniejący model danych i generowanie ASM w:
   - `sources/elements/dataElement.ts`
   - `sources/elements/data/json.ts`
   - `sources/elements/data/initialize.ts`
   - `sources/elements/clasElement.ts`
   - `sources/maths/parser.ts` i `sources/maths/emitter.ts`
2. Dodaj reprezentację runtime wartości JSON z tagiem typu i obsługą zagnieżdżonych obiektów/tablic. Zdefiniuj jawnie:
   - układ i znaczenie tagów,
   - sposób alokacji, własność i zwalnianie pamięci,
   - reprezentację brakującego pola (`undefined`) odróżnioną od JSON `null`,
   - zachowanie dla błędnego JSON-u i błędnego dostępu do pola.
3. Nie naruszaj istniejącego kompilowania JSON znanego statycznie. Zachowaj dotychczasowe typowanie i serializację literałów oraz stałych.
4. Dodaj ścieżkę runtime dla `JSON.parse` przyjmującego tekst dostępny dopiero w czasie wykonania. Wynik runtime powinien być dynamiczny (`any`/dynamiczny typ JSON), a nie fikcyjną klasą o statycznym układzie pól.
5. Dodaj test kompilatora/runtime dla runtime `JSON.parse` obejmujący obiekt, zagnieżdżony obiekt, tablicę, tekst, liczbę, boolean, `null`, pusty obiekt/tablicę oraz błędny JSON.

## Etap 2 — obsłuż dynamiczny dostęp do danych w kompilatorze

1. Rozszerz parsowanie wyrażeń i generowanie kodu, aby dynamiczne wartości obsługiwały:
   - dostęp do pola przez kropkę, np. `value.profile.name`,
   - indeksowanie obiektu kluczem tekstowym i tablicy indeksem,
   - zagnieżdżanie dostępu,
   - przekazywanie dynamicznych wartości do funkcji i `console.log`.
2. Dynamiczne wartości muszą zachować tag typu podczas odczytu i przekazywania. Dodaj wymagane konwersje/guardy w miejscach, gdzie kompilator oczekuje konkretnego typu; nie traktuj wskaźnika do węzła JSON jako liczby.
3. Dodaj obsługę `console.log` dla dynamicznych wartości i struktur, bez wypisywania ich adresów pamięci.
4. Jeśli `JSON.stringify` otrzyma dynamiczną wartość runtime, serializuj jej aktualny stan runtime. Zachowaj dotychczasową ścieżkę kompilacji znanych wartości i opcjonalnych argumentów `replacer`/`space`.
5. Dodaj testy dynamicznego odczytu i serializacji. Sprawdź również, że statyczne przypadki z `examples/testjson.ts` nadal działają.

## Etap 3 — parsuj query i treść żądania HTTP

1. Rozszerz `Request` w `examples/system/http.ts` o:
   - `query`: dynamiczny obiekt parametrów z URL,
   - `body`: dynamiczną wartość, która dla treści tekstowej zawiera tekst, a dla JSON-u sparsowany wynik parsera runtime.
2. Zachowaj `req.url` w obecnym formacie, łącznie z query stringiem. Brak query daje pusty obiekt.
3. Parsuj parametry query z URL:
   - dekoduj `%HH` i zamieniaj `+` na spację,
   - wartości query pozostają tekstami,
   - powtarzające się klucze zachowują wszystkie wartości w kolejności jako tablica,
   - puste wartości i parametry bez `=` są obsługiwane.
4. Ustal typ body na podstawie nagłówka `Content-Type` bez rozróżniania wielkości liter:
   - `application/json` oraz typy kończące się na `+json` parsuj jako JSON,
   - ignoruj parametry media type, np. `; charset=utf-8`,
   - brak nagłówka lub inny typ pozostawia body tekstowe.
5. Odbieraj całe żądanie, nie zakładaj, że nagłówki i body przyjdą w jednym `recv`. Obsłuż `Content-Length`; jeśli implementujesz `Transfer-Encoding: chunked`, dekoduj chunked przed parsowaniem body. Nie odczytuj poza zaalokowany bufor.
6. Wybierz i udokumentuj limit rozmiaru żądania/body. Przy przekroczeniu limitu lub błędnym framingu zgłoś błąd HTTP i zakończ obsługę tego połączenia bez cichego obcięcia danych.
7. Zadbaj o czas życia danych dynamicznych: `query`, body i węzły JSON muszą pozostać dostępne przez cały callback, a następnie zostać zwolnione bez zwalniania pamięci należącej do request buffer.

## Etap 4 — testy integracyjne, przykład i dokumentacja

1. Rozszerz `examples/testhttp.ts` o testowe użycie query oraz body tekstowego i JSON-owego. Plik ma już niezapisane zmiany użytkownika — zachowaj je i zintegruj, nie zastępuj pliku wersją bazową.
2. Zweryfikuj co najmniej:
   - GET z query, w tym kodowanie URL, puste wartości i powtórzone klucze,
   - POST z `text/plain`,
   - POST z `application/json` oraz `application/json; charset=utf-8`,
   - JSON zagnieżdżony i tablicę,
   - request rozdzielony na kilka odczytów TCP,
   - błędny JSON, błędny `Content-Length` i przekroczenie limitu,
   - brak regresji w istniejących metodach HTTP, nagłówkach i odpowiedziach.
3. Uaktualnij sekcję HTTP i JSON w `README.md`: opisz typowanie runtime JSON, query, body, limity, obsługiwane framingi i ograniczenia.
4. Uruchom testy kompilatora dla istniejących przykładów JSON/HTTP oraz test integracyjny serwera z klientem lokalnym. Zgłoś jawnie testy wymagające ręcznego uruchomienia serwera.

## Kryteria akceptacji

- `JSON.parse` działa zarówno dla dotychczasowych literałów/stałych, jak i dla tekstu runtime.
- Pola i indeksy runtime JSON nie wymagają znanego kompilatorowi schematu i zachowują typy JSON.
- `req.query` i `req.body` są dostępne w callbacku zgodnie z kontraktem powyżej.
- Body tekstowe nie jest niejawnie parsowane; body JSON jest parsowane na podstawie `Content-Type`.
- Żądania większe niż pojedynczy odczyt TCP są obsługiwane poprawnie albo odrzucane jawnie zgodnie z ustalonym framingiem/limitem.
- Dotychczasowe testy i zachowanie istniejącego `JSON.parse`, `JSON.stringify`, nagłówków i odpowiedzi HTTP pozostają poprawne.
- Zmiany są ograniczone do kompilatora, HTTP, testów/przykładów i bezpośrednio związanej dokumentacji.
