# Backlog

Lista rzeczy do zrobienia po ostatnich pracach nad statystykami, lista "Do uzupelnienia" i poprawkami stabilnosci. Priorytety sa praktyczne: najpierw rzeczy, ktore zwiekszaja wiarygodnosc danych i wygode pracy, potem wieksze zmiany architektoniczne.

## Roadmapa maturity - 2026-08-27

Kolejnosc zaakceptowana po przekrojowym przegladzie produktu:

1. **Centrum jakosci danych 2.0 - IN PROGRESS.** Pierwszy przyrost: szybka
   edycja GPS/opisu/notatek ma wracac do tej samej listy z zachowaniem
   filtrow; miejsce bez wizyt mozna przypisac do wybranej podrozy i uzupelnic
   daty pobytu. Kolejne mozliwe przyrosty: oznaczenie braku jako swiadomie
   pominietego, operacje seryjne i licznik ostatnio poprawionych rekordow.
2. **Browser E2E w CI - NEXT.** Playwright dla logowania, CRUD podrozy,
   dodania miejsca, soft delete/restore, inspiracji, mapy i centrum brakow;
   co najmniej jeden viewport mobilny. Kryterium: test blokuje merge przy
   regresji krytycznej sciezki.
3. **Zweryfikowany backup i restore - PLANNED.** Import backupu z dry-run,
   walidacja wersji, automatyczny backup przed zapisem i test odtworzenia na
   tymczasowym schemacie PostgreSQL. Kryterium: raport utworzonych,
   zmienionych i pominietych rekordow oraz powtarzalny test restore.
4. **Role owner/viewer i bezpieczny podglad - PLANNED.** Viewer bez mutacji,
   redakcja kosztow/prywatnych notatek i opcjonalny czasowy link do wybranej
   podrozy. Kryterium: egzekwowanie roli jednoczesnie w API, UI i cache PWA.
5. **Kontrolowana praca offline - PARKING.** Zaczac tylko od lokalnych szkicow
   tekstowych, jawnego stanu synchronizacji i obslugi konfliktu; nie otwierac
   od razu pelnej kolejki wszystkich mutacji.

## Aktualny audyt backlogu - 2026-06-17

Ten plik jest juz bardziej mapa decyzji i historia roadmapy niz prosta lista
TODO. Wpisy `DONE` zostaja, bo tlumacza dlaczego aplikacja wyglada tak, a nie
inaczej. Do startu nowej sesji nadal uzywac najpierw `CURRENT_STATE.md`.

**Co tu jest:**
- P0/P3: fundamenty techniczne, bezpieczenstwo, testy, cache, migracje,
  wydajnosc i dlugi architektoniczne.
- P1/P2: analityka, UX i praca z danymi; wiekszosc najwazniejszych tematow z
  tych sekcji jest juz domknieta.
- P4: pomysly pozniejsze albo parking dla rzeczy, ktore maja sens dopiero po
  recznej potrzebie.

**Najlepsze aktywne tematy wg potencjalnej korzysci:**
1. **Jakosc danych miejsc** - kontynuowac konkretne `address`/`notes` malymi
   partiami i recznie przejrzec 142 miejsca bez GPS. To bezposrednio zwieksza
   wartosc mapy, statystyk i list brakow.
2. **Browser E2E / Node LTS w PATH** - najwieksza luka stabilnosci frontendu.
   Najpierw naprawic zwykly Node, potem dodac maly browser smoke kluczowych
   ekranow.
3. **Role admin/viewer + cache po rolach** - duza korzysc, jesli aplikacja ma
   byc pokazywana komus poza adminem. Wiekszy zakres, bo dotyka API, UI i PWA.
4. **Mala analityka kosztow albo Rocznik jako pamiatka** - sensowne UX/product
   follow-upy, ale mniej pilne niz jakosc danych i E2E.
5. **Drobny polish produkcyjny** - Statystyki i `#/locations/todo` po
   `45f26d7` zostaly recznie sprawdzone i dzialaja dobrze; wracac tylko jesli
   po dluzszym uzyciu wyjdzie tekst/spacing do poprawy.

**Tematy techniczne nadal sensowne, ale nie na goraco:**
- rate limiter logowania odporny na wiele workerow,
- dalsze selektywne dzielenie `locations.js` / `app.css` i delegacja zdarzen,
- wydzielenie kolejnych agregacji statystyk z `stats.py`,
- rozszerzanie realnego PostgreSQL fixture tylko wtedy, gdy nowe prace dotkna
  danego przeplywu.

**Tematy do parkingu / niski priorytet teraz:**
- pelna migracja frontendu na moduly/bundler,
- zdjecia i albumy,
- przyjazny import/eksport czastkowy,
- onboarding nowego uzytkownika, dopoki aplikacja pozostaje prywatna i ma
  wypelniona baze.

**Najwazniejsze korekty aktualnosci po audycie:**
- Sekcyjne endpointy statystyk `/api/stats/section/<section>` sa juz zrobione
  w `45f26d7`; dalsza optymalizacja statystyk powinna wynikac z realnego laga
  albo pomiaru, nie z samego dlugu historycznego.
- Realny PostgreSQL fixture na tymczasowym schemacie juz istnieje i obejmuje
  najwazniejsze odczyty/zapisy; backlog powinien mowic raczej o rozszerzaniu
  go punktowo.
- Centrum brakow miejsc ma juz szybkie akcje, sort/filter deep linki i
  grupowanie po kraju/typie braku; dalszy UX tego widoku to juz polish po
  realnym uzyciu.
- P0 nie ma obecnie jednego oczywistego krytycznego zadania kodowego. Najblizej
  P0 operacyjnie jest potwierdzenie stalego `SECRET_KEY` w Renderze, jesli nie
  zostalo juz sprawdzone w logach.

## P0 - Pilne po audycie architektury

Uwaga po audycie 2026-06-17: ta sekcja jest w wiekszosci historia domknietych
fundamentow. Nie ma obecnie jednego oczywistego P0 kodowego. Aktywne ryzyka z
tej grupy to raczej: potwierdzenie stalego `SECRET_KEY` w Renderze, przyszle
role viewer/admin oraz rate limiter logowania, jesli aplikacja bedzie dzialac
na wielu workerach.

### 0. Audyt Claude Code 2026-05-28: bezpieczenstwo i fundamenty - PARTIAL

**Status:** dopisane po analizie zrzutow `Co jest dobrze/slabe/Rekomendacja i ocena 2026-05-28` oraz szybkim sprawdzeniu aktualnego kodu. Pierwsza partia P0 zrobiona w `Improve database and stats performance`: connection pooling, indeksy relacji/aktywnych rekordow i krotki cache TTL dla `/api/stats` uniewazniany po zapisach. Druga partia P0 zrobiona w `Harden frontend and data constraints`: XSS audit najczestszych select/input rendererow, jedno zrodlo polityki `no-store` oraz `Decimal`/CHECK constraints dla danych domenowych. Trzecia partia P0 zrobiona w `Add admin-only authentication`: logowanie admin-only haslem z env, sesja Flask, blokada prywatnego API, ekran login/logout i czyszczenie cache/IDB przy wylogowaniu.

**Z czym sie zgadzam i podnosze do najwyzszego priorytetu:**
1. Auth natychmiast - PARTIAL (admin-only DONE). Aplikacja ma juz logowanie admin-only, sesje, blokade prywatnego API i rate limit blednych logowan. Do zrobienia pozniej: pelne role admin/viewer, redakcja kosztow dla viewerow i ukrywanie widokow administracyjnych.
2. Connection pooling - DONE. `core.get_db()` korzysta z `psycopg2.pool.ThreadedConnectionPool` zamiast otwierac nowe polaczenie per request. Rozmiar puli mozna ustawic przez `DB_POOL_MINCONN` i `DB_POOL_MAXCONN`.
3. Migracje wersjonowane - DONE. `ensure_schema()` nadal zachowuje zasade "no manual steps after deploy", ale deleguje prace do `schema_migrations.py`: migracje maja wersje, nazwy i zapis w tabeli `schema_migrations`. Wybrany zostal prosty wlasny system zamiast Alembic, bo pasuje do malej aplikacji i deployu na Renderze bez dodatkowych komend.
4. Indeksy FK i partial indexes - DONE. `ensure_schema()` tworzy idempotentnie indeksy pod relacje i aktywne rekordy, szczegolnie `travel_locations(travel_id)`, `travel_locations(location_id)`, `travel_participants(travel_id/person_id)`, `locations(parent_location_id)`, `locations(country_id)`, `travels(start_date) WHERE deleted_at IS NULL` i `locations(country_id) WHERE deleted_at IS NULL`.
5. Budzet zapytan dla `/api/stats` - MOSTLY DONE. Endpoint nadal istnieje jako
   pelny kompatybilny kontrakt, ale najciezsze wejscie UI zostalo rozbite:
   `Optimize stats query budget` obnizyl zimny budzet `/api/stats?year=...`
   orientacyjnie z ok. 42 do ok. 23 zapytan, `Add stats overview endpoint` i
   `Load stats overview first` dodaly lekki `/api/stats/overview`, a
   `45f26d7 Split stats sections and group location worklist` dodal
   `/api/stats/section/<section>` dla `yearbook`, `countries`, `costs`,
   `participants` i `quality`. Kolejny krok tylko jesli pojawi sie realny lag:
   pomiar czasow na produkcji albo dalsze wspoldzielenie danych miedzy
   agregatami krajow.
6. Audyt XSS w frontendzie - DONE. Dynamiczne opcje selectow i wartosci inputow w miejscach/osobach/podrozach/mapie/kreatorze ida przez `renderSelectOptions()` i `escapeAttr()` zamiast lokalnych template stringow albo recznego `replace(/"/g, '&quot;')`.
7. Jedno zrodlo polityki `no-store` - DONE. Backendowe listy `NO_STORE_EXACT_API_PATHS` i `NO_STORE_API_PREFIXES` w `app.py` sa zrodlem prawdy, a `/sw.js` wstrzykuje je do service workera przy serwowaniu pliku.
8. Realniejsze testy integracyjne - DONE jako pierwszy stabilny fixture.
   `tests/test_postgres_integration.py` uruchamia sie opcjonalnie z
   `TEST_DATABASE_URL` na tymczasowym schemacie i sprawdza realne zapytania,
   kosz, statystyki, kreator zapisu oraz CRUD miejsc. Dalsze rozszerzenia robic
   punktowo przy zmianach konkretnych endpointow.
9. Pieniadze jako `Decimal`/`NUMERIC` i CHECK constraints w DB - DONE. `amount` w Pydantic jest `Decimal`, `migrate.py` tworzy schemat z ograniczeniami, a `ensure_schema()` dopina idempotentne CHECK constraints dla kwot, walut, dat, ratingu, lotow, dat pobytu i GPS.
10. Strukturalne logowanie/Sentry. Przydatne, ale po auth, migracjach, poolingu, indeksach i statystykach.

**Korekty / z czym nie zgadzam sie wprost:**
- `/api/stats` jest realnym dlugiem wydajnosciowym, ale nie powinien wyprzedzic auth. Brak autoryzacji ma wiekszy koszt ryzyka niz wolniejszy ekran statystyk.
- Alembic jest najlepszym standardowym wyborem, ale nie narzucam go jako jedynej opcji. Dla tej aplikacji akceptowalny bylby tez maly, wersjonowany system migracji, jesli zachowa deterministyczne uruchamianie na Renderze.
- Frontend ESM + bundler to dobry kierunek, ale nie P0. Migracja globalnych skryptow na moduly moze wygenerowac duzy churn, wiec najpierw warto domknac security i backendowe fundamenty.
- `migrate.py` w katalogu glownym jest do uporzadkowania, ale nie traktuje tego jako krytycznego ryzyka. `connection string.txt` jest wpisany w `.gitignore`, wiec na tym etapie to glownie temat higieny repo i lokalnych plikow.
- Sentry/structured logging popieram, ale jako nizszy priorytet niz blokady dostepu, migracje, pooling i indeksy.

**Smoke testy po realizacji pierwszej partii P0:**
1. Wejsc bez zalogowania w `/`, `/api/export`, `/api/trash` i dowolna mutacje API; prywatne endpointy powinny wymagac logowania albo zwracac 401/403.
2. Zalogowac sie jako admin i sprawdzic: lista podrozy, szczegoly podrozy, edycja, kosz, backup.
3. Po wdrozeniu przyszlych rol viewer/admin zalogowac sie jako viewer i
   sprawdzic: brak kosztow w UI i JSON API, brak mozliwosci mutacji, brak
   widokow administracyjnych. Ten punkt nie dotyczy obecnego admin-only auth.
4. Po zmianach DB odpalic migracje na pustej bazie i na istniejacej bazie; oba przebiegi powinny byc idempotentne.
5. Otworzyc Statystyki na cieplym i zimnym starcie; porownac liczbe/czas zapytan przed i po optymalizacji.

## P1 - Najblizsze

### 1. Szybka edycja z listy "Do uzupelnienia" - DONE

**Status:** zrobione w `424c743 Add quick edit from completion list`.

**Weryfikacja:** w Statystyki -> Jakosc danych -> Lista klik "Edytuj" przy podrozy; powinien otworzyc sie formularz tej podrozy.

### 2. Dalsze rekordy w Hall of Fame - DONE

**Status:** zrobione w `7211d05 Expand stats hall of fame`.

**Dopiete pozniej:** w `Improve hall of fame grid` Hall of Fame zostal przebudowany z poziomej listy na responsywna siatke rekordow. Przy okazji doprecyzowano klikalnosc kafli oraz utwardzono agregaty dla liczby miejsc i najdluzszej przerwy.

**Weryfikacja:** sekcja Hall of Fame pokazuje nowe kafle, a klik w rekord zwiazany z podroza otwiera jej szczegoly.

### 3. Koszty - srednie i rozklad - PARTIAL

**Status:** czesciowo zrobione w `Add cost summary stats`.

**Problem:** koszty sa obecnie prezentowane glownie jako suma per waluta i top najdrozszych wyjazdow.

**Zrobione:**
- sredni koszt podrozy per waluta,
- mediana kosztu podrozy per waluta,
- koszt per dzien per waluta,
- liczba podrozy z kosztem per waluta.

**Do dodania pozniej:**
- miesiace/lata z najwyzszymi kosztami,
- opcjonalnie reczne kursy walut albo wybrana waluta bazowa.

**Weryfikacja:** statystyki kosztow nie sumuja roznych walut w jedna liczbe bez jasnej etykiety.

### 4. Kraje i powroty - glebsza analityka - DONE

**Status:** zrobione w `Add country history analytics`.

**Zrobione:**
- agregat `country_history` w `/api/stats`,
- pierwsza i ostatnia wizyta w kazdym kraju,
- kraje z najczestszymi powrotami,
- kraje odwiedzane najregularniej,
- kraje najdluzej niewidziane,
- najdluzsze przerwy miedzy wizytami,
- kraje odwiedzone tylko raz,
- karta "Historia krajow" w ekranie Statystyki,
- testy kontraktu API i test logiki agregacji kraju.

**Weryfikacja:** po wyborze roku widac nie tylko nowe/powrotne kraje, ale tez kontekst historii wizyt.

## P2 - UX i praca z danymi

### 0. Nastepny priorytet po przerwie: karta szczegolow podrozy po duzych importach

**Status:** zrobione w `Redesign travel detail card`.

**Decyzja:** zaczac od UX/UI, nie od czystego refaktoru. Refaktor dopuszczalny tylko jako porzadkowanie przy okazji wdrozenia.

**Kontekst:** po imporcie opisow dla `Gory Literatury z Olga` i `Workation w Trapani` aplikacja ma duzo bogatsze notatki oraz znacznie dluzsze listy miejsc w podrozy. Karta szczegolow podrozy musi lepiej uniesc takie dane, szczegolnie na iPhonie.

**Zakres:**
- uporzadkowac szczegoly podrozy w wyrazne sekcje: podsumowanie, uczestnicy, miejsca, notatki, refleksje,
- poprawic prezentacje dlugich notatek, np. czytelne bloki dzienne albo zwijanie/rozwijanie,
- liste miejsc w podrozy pokazac bardziej trasowo: daty, kraj/typ, wazne miejsca i notatki bez sciany tekstu,
- dopilnowac ergonomii na iPhonie, bo dlugie podroze najszybciej pokaza slabosci ukladu,
- zachowac istniejaca logike danych i nie ruszac modelu bazy, jesli nie bedzie to konieczne.

**Zrobione:**
- karta szczegolow podrozy ma teraz sekcje: naglowek z metrykami, podsumowanie, uczestnicy, trasa i miejsca, notatki dzienne, wspomnienia oraz zarzadzanie,
- miejsca w podrozy sa pokazywane jako trasa grupowana po dacie przyjazdu, z krajem, typem i kompaktowym podgladem notatki,
- notatki importowane w formacie `YYYY-MM-DD - opis` sa renderowane jako zwijane bloki dzienne,
- edycja podrozy zostala przeniesiona z plywajacego przycisku do naglowka, zeby na iPhonie nie zaslaniac tresci.

**Weryfikacja:** otworzyc `Gory Literatury z Olga` i `Workation w Trapani` na desktopie oraz iPhonie. Uzytkownik powinien szybko zrozumiec przebieg podrozy, miejsca i notatki bez poczucia przytloczenia.

### 0a. Przebudowa Podsumowania statystyk - DONE

**Status:** zrobione w `b5f4727 Tidy stats overview dashboard`.

**Problem:** zakladka `Statystyki -> Podsumowanie` ma wartosciowe dane, ale wizualnie konkuruje sama ze soba: gradientowy hero, kolorowe stat-karty, Hall of Fame, streak, wykresy i rankingi maja zbyt wiele roznych stylow, kolorow i poziomow waznosci. Przez to najwazniejsze informacje nie sa czytane wystarczajaco szybko.

**Proponowany kierunek:** przebudowac widok jako spokojniejszy dashboard z wyrazna hierarchia:
- naglowek i filtr roku,
- podzakladki statystyk,
- blok "Najwazniejsze liczby" jako neutralne karty z malym akcentem koloru, bez mocnych gradientow,
- blok "Aktualny kontekst" dla aktualnej podrozy / streaka / kompletacji danych,
- Hall of Fame jako mocna, ale spojna sekcja rekordow,
- wykresy i analizy nizej, w jednolitych kartach.

**Zasady UI:**
- ograniczyc liczbe konkurujacych gradientow i mocnych kolorow,
- kolor traktowac jako akcent znaczeniowy, a nie dekoracje kazdej karty,
- ujednolicic typy kart na stronie: metryki, rekordy, kontekst, wykresy,
- na iPhonie pokazac najpierw 4 najwazniejsze liczby, potem pozostale informacje w czytelnej kolejnosci,
- zachowac obecna logike danych, ale poprawic hierarchie wizualna i rytm sekcji.

**Zakres pierwszego kroku:**
- uporzadkowac hero i `stats-grid`,
- wyciszyc gradientowe stat-karty,
- ulozyc Hall of Fame i streak w jednym spokojnym rytmie,
- zostawic glebsze wykresy bez duzej przebudowy logiki.

**Weryfikacja:** na desktopie i iPhonie `Statystyki -> Podsumowanie` powinno szybko odpowiadac: ile podrozy/dni/krajow/miejsc, co jest teraz wazne oraz jakie sa rekordy, bez wrazenia kolorowego balaganu.

### 5. Widok miejsc "Do uzupelnienia" - DONE

**Status:** zrobione w `34f9ee9 Add location completion worklist`.
Dopiete pozniej w kolejnych malych pracach: filtr/sort z deep linkiem,
kolorowe etykiety brakow, szybkie akcje `GPS`/`Adres`/`Notatki`/`Wizyty`,
optymalizacja sortowania oraz grupowanie po kraju albo typie braku w
`45f26d7 Split stats sections and group location worklist`.

**Weryfikacja:** osobny filtr/lista pozwala szybko znalezc miejsca wymagajace poprawy.

### 6. Lepsze filtrowanie miejsc - DONE

**Status:** zrobione w `Add location filters and sorting`.

**Dodane:**
- filtr kraju,
- filtr typu miejsca,
- filtr "bez GPS",
- filtr "odwiedzone / nieodwiedzone",
- sortowanie po liczbie wizyt i ostatniej wizycie,
- liczba wizyt i ostatnia wizyta na kafelkach miejsc,
- dopiete w `Improve location filters and detail card`: podsumowanie aktywnych filtrow, przycisk "Wyczysc filtry" i czytelniejsza karta szczegolow miejsca.

**Weryfikacja:** lista miejsc pozwala szybko znalezc np. wszystkie miasta w Finlandii bez wspolrzednych.

### 7. Lepsze komunikaty bledow w UI - DONE

**Status:** zrobione w `Improve UI error messages`.

**Zrobione:**
- wspolny helper `toastApiError()` i formatowanie komunikatow API,
- status HTTP dopinany do bledow mutacji,
- czytelniejsze komunikaty dla 404/offline/walidacji/konfliktow,
- obsluga bledow przy delete/restore dla podrozy, miejsc, osob i slownikow,
- obsluga bledow przy dodawaniu/usuwaniu uczestnikow i miejsc z podrozy,
- ostrzezenie, gdy kreator utworzy podroz, ale nie dopnie wszystkich miejsc/uczestnikow.

**Weryfikacja:** wymuszone bledy API pokazuja uzytkownikowi zrozumialy toast albo stan pusty, a nie cichy brak reakcji. Usuwanie/przywracanie nie powinno pokazywac sukcesu, jesli API zwrocilo blad.

### 8. Profesjonalizacja ekranu statystyk

**Status:** zrobione w `Split stats into sections`.

**Zrobione:** podzial ekranu Statystyki na podzakladki:
- Podsumowanie,
- Kraje i miejsca,
- Koszty,
- Uczestnicy,
- Jakosc danych.

**Weryfikacja:** ekran jest mniej dlugi i latwiej znalezc konkretna analize.

### 8a. Os czasu jako osobna zakladka - DONE

**Status:** osobna zakladka zostala usunieta w `Remove timeline tab`.

**Uzasadnienie:** widok dublowal liste podrozy, ale mial mniej filtrow i nie dawal wystarczajaco nowej wartosci, zeby zajmowac miejsce w dolnej nawigacji.

**Weryfikacja:** dolna nawigacja ma cztery glowne obszary: Podroze, Miejsca, Mapa, Statystyki.

### 8b. Ujednolicenie UI - faza 1 - DONE jako etap historyczny

**Status:** pierwsza faza zaczeta w `Unify basic UI controls`, a jej glowne
follow-upy zostaly domkniete w fazach 2-4 oraz w pozniejszych pracach nad
`components.js`, widokami pomocniczymi i desktop shell.

**Zrobione:**
- wspolne klasy CSS dla filtrow (`filter-grid`, `filter-select`) i malych akcji (`action-strip`, `action-button`, `icon-button`),
- podpiecie nowych klas w widoku Miejsca,
- podpiecie nowych klas w pasku narzedzi mapy.

**Do zrobienia dalej:** brak jako osobny etap. Dalsze porzadkowanie frontendu
trzymac w P4/16 i robic tylko selektywnie.

**Weryfikacja:** filtry i przyciski narzedziowe w Miejscach oraz na Mapie wygladaja spojniej i korzystaja ze wspolnych klas.

### 8c. Ujednolicenie UI - faza 2 - DONE jako etap historyczny

**Status:** kolejna faza zaczeta w `Unify detail action controls`, a brakujace
formularze/modale zostaly uporzadkowane w fazie 3 i 4.

**Zrobione:**
- wspolne klasy dla akcji w naglowkach sekcji (`section-actions`, `section-action`),
- wspolne klasy dla malych przyciskow w wierszach (`row-actions`, `row-icon-button`),
- uporzadkowanie przyciskow dodawania/mapy w szczegolach podrozy,
- uporzadkowanie przyciskow edycji/usuwania miejsc w podrozy,
- uporzadkowanie chipow uczestnikow,
- pierwsze wspolne klasy dla linkow i metadanych w szczegolach miejsc.
- dopiete pozniej w `Tidy auxiliary views`: kompaktowe filtry w widokach "Do uzupelnienia" i "Miejsca do uzupelnienia" oraz wspolne klasy wierszy i akcji Kosza.

**Do zrobienia dalej:** brak jako osobny etap. Jesli wracac do UI cleanupu,
robic male, widoczne ciecia z P4/16.

**Weryfikacja:** w szczegolach podrozy przyciski `Mapa`, `Dodaj`, edycja/usuwanie miejsc i usuwanie uczestnikow maja spojny wyglad.

### 8d. Ujednolicenie UI - faza 3 - DONE

**Status:** formularze i listy modalne uporzadkowane w `Unify modal form controls`.

**Zrobione:**
- wspolne klasy dla glownych przyciskow formularzy (`form-primary-btn`, `form-secondary-btn`),
- wspolna klasa dla rzedow inline w formularzach (`form-inline-row`),
- wspolne klasy dla geokodowania i wynikow geokodowania (`form-icon-btn`, `form-results`, `form-result-item`),
- podpiecie nowych klas w formularzu miejsca uzywanym przez widok Miejsca i kreator,
- podpiecie nowych klas w edycji miejsca, edycji pobytu, dodawaniu miejsca do podrozy oraz dodawaniu uczestnika,
- przeniesienie styli list i edycji inline w modalach Osoby i Slowniki do wspolnych klas.

**Do zrobienia dalej:**
- zrealizowane w fazie 4.

**Weryfikacja:** modale dodawania/edycji miejsca, dodawania miejsca do podrozy, edycji pobytu, dodawania uczestnika, Osoby i Slowniki maja spojniejsze przyciski oraz rzedy formularzy.

### 8e. Ujednolicenie UI - faza 4 - DONE

**Status:** zrobione w `Unify wizard UI controls`.

**Zrobione:**
- uporzadkowanie paneli i pustych stanow w kreatorze podrozy,
- wspolne renderowanie dodanych miejsc, listy wyboru miejsc i listy uczestnikow,
- podpiecie wspolnych klas przyciskow formularzy w kreatorze,
- usuniecie powtarzalnych inline styli z `wizard.js` poza dynamicznym kolorem ikony celu podrozy,
- ujednolicenie modala konfliktu dat przy zmianie zakresu podrozy,
- dodanie trzeciej opcji "Przytnij do zakresu podrozy" w ostrzezeniach o datach wizyty poza zakresem.

**Weryfikacja:** w kreatorze przejsc kroki Podstawowe info -> Lokacje -> Uczestnicy -> Podsumowanie, dodac/zdjac miejsce i uczestnika, a przy edycji dat istniejacej podrozy sprawdzic modal konfliktu dat. Przy dodawaniu/edycji pobytu poza zakresem powinny byc trzy opcje: przytnij, zapisz mimo to, anuluj.

### 8f. Profesjonalizacja UI - desktop shell - DONE

**Status:** zrobione w `Professionalize desktop app shell`.

**Zrobione:**
- desktopowa nawigacja boczna zamiast dolnego paska na szerokich ekranach,
- ograniczenie szerokosci list, statystyk, filtracji i szczegolow do wspolnego rytmu,
- czytelniejszy uklad filtrow i akcji w widoku Miejsca na desktopie,
- dopasowanie mapy i przycisku dodawania do ukladu bez dolnej nawigacji.

**Weryfikacja:** na desktopie sprawdzic Podroze, Miejsca, Mape, Statystyki i szczegoly podrozy/miejsca; na telefonie dolna nawigacja nadal powinna zostac na dole.

## P3 - Stabilnosc, bezpieczenstwo, architektura

### 9. Testy automatyczne dla logiki dat i statystyk - PARTIAL

**Problem:** najwazniejsza logika domenowa jest obecnie weryfikowana glownie recznie. Dotyczy to szczegolnie statystyk, dat i jakosci danych.

**Status:** pierwszy pakiet smoke testow dodany w `Add automated smoke tests`, uzupelniony o kontrakty API w `Add API contract smoke tests`.

**Zrobione:**
- Python `unittest` dla inkluzywnego liczenia dni, przycinania podrozy do roku i walidacji Pydantic,
- JS smoke testy dla `daysCount`, polgwiazdek, komunikatow API, blokady podwojnych akcji, `removeWithSlide` i przycinania dat pobytu,
- minimalne testy kontraktu `/api/stats`, `/api/stats/todo` i `/api/locations/todo`,
- GitHub Actions uruchamiaja testy Python i JS przy pushu.
- uzupelnione w `Add stats section smoke tests`: JS smoke dla podzakladek Statystyk i glebszy kontrakt `/api/stats` dla sekcji kosztow, krajow/miejsc, uczestnikow i jakosci danych.
- uzupelnione w `Add mobile UI smoke tests`: JS smoke dla mobilnego ukladu mapy, resetu scrolla przy zmianie zakladek oraz blokady dublowania modali.
- uzupelnione w `Add key API flow smoke tests`: Python smoke dla zalogowanego odczytu glownego shella, list podrozy/miejsc, slownikow, kosza i healthchecka oraz dla podstawowego zapisu podrozy, miejsca, osoby i dopiecia relacji.
- uzupelnione w `Add key flow smoke coverage`: Python smoke dla blokady prywatnych endpointow bez sesji, mapy miejsc, soft delete/restore podrozy i miejsc oraz odpinania miejsc/uczestnikow z podrozy; JS smoke pilnuje tez zawijania dlugich tytulow w Roczniku.

**Do dodania dalej:**
- testy jakosci danych podrozy,
- testy jakosci danych miejsc,
- testy nowych/powrotnych krajow,
- glebsze testy kontraktow z realistycznym zestawem danych statystyk,
- rozszerzenia realnego PostgreSQL fixture tylko dla przeplywow, ktore beda
  dotykane w kolejnych zmianach.

**Weryfikacja:** GitHub Actions uruchamia testy przy pushu i lapie regresje w statystykach.

### 9a. Produkcyjny smoke po deployu - DONE

**Problem:** GitHub Actions potwierdza jakosc kodu przed deployem, ale po stronie Rendera nadal mozna miec osobny problem operacyjny: port, start procesu, konfiguracja env, DB albo cache PWA. Ostatni blad `Port scan timeout reached` pokazal, ze warto miec jednoznaczny test "czy produkcja zyje".

**Status:** zrobione w `Add production smoke test`.

**Zrobione:**
- dodany `tools/smoke_prod.py` przyjmujacy URL bazowy, domyslnie `https://moje-podroze.onrender.com`,
- sprawdza publiczne endpointy bez sekretow: `/healthz`, `/`, `/api/auth/status`, `/api/travels` jako 401 bez sesji, `/sw.js`, `/static/manifest.json` i kluczowe ikony,
- zwraca czytelny raport OK/FAIL z kodami HTTP, czasem requestu i krotkim opisem,
- opisane uzycie w `AGENTS.md` jako reczny smoke po deployu Rendera.

**Weryfikacja:** po kazdym deployu jedna komenda potwierdza, ze aplikacja wystawia port, DB odpowiada, auth jest skonfigurowany, prywatne API jest zablokowane bez sesji, a shell/PWA assety sa dostepne.

### 9b. Realistyczny test integracyjny na schemacie testowym - DONE / EXTEND AS NEEDED

**Status:** zrobione w `9ce436d Add PostgreSQL integration smoke` i
rozszerzone pozniej o kreator zapisu, edycje zakresu dat podrozy oraz CRUD
miejsc. Test jest opcjonalny, wymaga `TEST_DATABASE_URL`, uruchamia sie na
tymczasowym schemacie i sprzata po sobie.

**Problem:** obecne testy kontraktowe i smoke sa wartosciowe, ale duza czesc backendu jest sprawdzana przez mockowane `query()`. To chroni kontrakt JSON i podstawowa logike, ale slabiej lapie regresje w prawdziwych zapytaniach PostgreSQL.

**Zrobione:** fixture sprawdza m.in. `/api/stats`, `/api/locations`,
`/api/map-locations`, szczegoly miejsca, `/api/trash`, kreator transakcyjny,
edycje dat pobytu i CRUD miejsc.

**Zasada:** nie budowac ciezkiego frameworka testowego. Rozszerzac tylko o
przeplywy wysokiego ryzyka, gdy kolejne prace dotkna danego endpointu.

**Weryfikacja:** test lapie blad w SQL albo joinach, ktorego nie zlapalby sam mock kontraktu.

### 9c. Browser smoke / E2E po naprawie Node

**Status:** kierunek po audycie 2026-06-02, zalezne od dostepnego Node w PATH.

**Problem:** lokalne `node` wskazuje obecnie na runtime z WindowsApps Codexa i zwraca `Odmowa dostepu`, przez co nie da sie stabilnie uruchamiac `node --check` ani docelowo lekkich testow browserowych.

**Propozycja:** po zapewnieniu zwyklego Node LTS w PATH dodac maly browser smoke dla kluczowych widokow: logowanie/shell, lista podrozy, szczegoly podrozy, Statystyki -> Rocznik, Statystyki -> Kraje i miejsca oraz Mapa.

**Zasada:** E2E ma lapac regresje widokow, nie testowac kazdego przycisku. Na start wystarczy kilka ekranow i sprawdzenie, ze kluczowe sekcje renderuja sie bez bledow.

**Weryfikacja:** po zmianach frontendowych test potwierdza, ze aplikacja renderuje najwazniejsze widoki w przegladarce.

### 10. Wspolne komponenty frontendu

**Problem:** frontend coraz czesciej sklada podobne elementy recznie w template stringach. Powtarzaja sie karty, badge, paski filtrow, puste stany, metryki i rankingowe belki.

**Status:** pierwszy krok zrobiony w `Extract stats UI components`.

**Zrobione:**
- dodany lekki `static/js/components.js`,
- wspolny renderer podzakladek,
- wspolny renderer pustej karty,
- wspolny renderer rankingowych belek,
- podpiecie pierwszych helperow w `stats.js`,
- rozszerzone w `Extend frontend components`: wspolne helpery dla selectow, paneli filtrow, badge'y, metryk hero i list kart,
- podpiecie nowych helperow w `travels.js`, `locations.js`, `todo.js` i glownej karcie podsumowania statystyk.

**Do rozwazenia dalej:** rozszerzac `static/js/components.js` bez frameworka o kolejne helpery, np.:
- kolejne wyspecjalizowane karty szczegolow,
- wspolne renderowanie metryk miejsc,
- wspolne renderowanie sekcji modalowych.

**Dopiete pozniej:** `Load stats overview first` zaczyna rozbijanie ekranu Statystyk od warstwy danych: sekcja Podsumowanie pobiera lekki `/api/stats/overview`, a pozostale sekcje nadal korzystaja z pelnego `/api/stats`. To pilot pod dalszy podzial `stats.js` bez rewolucji w calym frontendzie.

**Aktualizacja 2026-06-17:** po `45f26d7` pozostale glowne sekcje Statystyk
pobieraja juz scoped endpointy `/api/stats/section/<section>`. `components.js`
jest przydatny i ma zostac lekki; nie robic z niego frameworka.

**Weryfikacja:** `stats.js`, `todo.js`, `locations.js` i `travels.js` maja mniej duplikacji, a wyglad kart/filtrow pozostaje spojny.

### 11. Kontrakty API dla widokow - PARTIAL

**Problem:** endpointy zwracaja coraz bogatsze struktury, ale ich kontrakty sa opisane tylko przez kod.

**Status:** minimalne smoke testy kontraktu dodane w `Add API contract smoke tests`.

**Zrobione:**
- test kontraktu `/api/stats`,
- test kontraktu `/api/stats/overview`,
- test kontraktu `/api/stats/section/<section>`,
- test kontraktu `/api/stats/todo`,
- test kontraktu `/api/locations/todo`.

**Do zrobienia dalej:**
- opisac odpowiedzi w dokumentacji technicznej,
- stopniowo opierac najwazniejsze kontrakty o realny PostgreSQL fixture tam,
  gdzie mock SQL robi sie kruchy,
- rozszerzac kontrakty tylko przy nowych polach albo zmianach widokow.

**Weryfikacja:** nowy agent albo przyszly refaktor wie, ktore pola sa wymagane przez UI.

### 12. Strategia cache/PWA pod dane wrazliwe - PARTIAL

**Problem:** service worker i IndexedDB cache sa bardzo przydatne, ale przy rolach uzytkownikow moga pokazac viewerowi dane admina, jesli cache nie bedzie rozdzielony lub czyszczony.

**Status:** pierwszy bezpieczny etap zrobiony w `Harden backup and sensitive cache`.

**Zrobione:**
- `no-store` dla endpointow z kosztami i danymi administracyjnymi: `/api/travels*`, `/api/stats*`, `/api/trash`, `/api/export`, `/api/locations/todo`,
- service worker nie zapisuje tych endpointow do IndexedDB ani Cache API i nie zwraca ich offline z lokalnego mirroru,
- service worker respektuje `Cache-Control: no-store`, jesli taki naglowek pojawi sie na innym API.

**Do zrobienia przy rolach viewer/admin:**
- czyscic cache/IndexedDB przy login/logout,
- upewnic sie, ze viewer po przelogowaniu nie widzi kosztow z poprzedniej sesji admina.

**Weryfikacja:** test reczny admin -> logout -> viewer nie pokazuje kosztow ani danych administracyjnych.

### 12b. Profesjonalniejszy eksport/backup JSON - DONE

**Status:** zrobione w `Harden backup and sensitive cache`.

**Zrobione:**
- backup ma metadane: nazwe aplikacji, typ eksportu, wersje schematu, date eksportu, kolejnosc tabel, liczbe rekordow per tabela i sume rekordow,
- plik pobiera sie jako `moje-podroze-backup-YYYY-MM-DD.json`,
- UI uzywa nazwy pliku z odpowiedzi serwera i pokazuje toast z liczba rekordow,
- eksport ma `Cache-Control: no-store`,
- dodany test kontraktu eksportu.

**Weryfikacja:** klik `Miejsca -> Backup`; pobrany JSON powinien zawierac `metadata`, `schema_version` i `tables`, a nazwa pliku powinna zaczynac sie od `moje-podroze-backup-`.

### 13. Migracje bazy danych - DONE

**Problem:** schemat byl utrzymywany przez helpery startowe i `migrate.py`. Przy rolach, ustawieniach, albumach albo kolejnych tabelach potrzebny byl bezpieczniejszy mechanizm zmian schematu.

**Status:** zrobione w `Add versioned schema migrations`.

**Zrobione:**
- dodany `schema_migrations.py` z rejestrem `SCHEMA_MIGRATIONS`,
- dodana tabela `schema_migrations(version, name, applied_at)`,
- dotychczasowe startowe zmiany schematu zostaly rozbite na wersje: soft delete/GPS, rating numeric, amount numeric, indeksy, CHECK constraints,
- `core.ensure_schema()` zostal uproszczony do transakcyjnego uruchomienia migracji przy starcie,
- `migrate.py --force` zostaje tylko do pelnej migracji SQLite -> PostgreSQL.

**Weryfikacja:** zmiana schematu moze byc odpalona deterministycznie na lokalnym srodowisku i Renderze.

### 14. Wydzielenie agregacji statystyk - PARTIAL

**Problem:** `stats.py` zawiera coraz wiecej zapytan analitycznych. To nadal dziala, ale plik bedzie trudny do utrzymania, jesli statystyki dalej beda rosly.

**Status:** trzy pierwsze etapy zrobione w `Extract country stats helpers`, `Extract stats quality helpers` i `Extract stats hall of fame helpers`.

**Zrobione:**
- wspolne helpery dat i zakresow przeniesione do `stats_common.py`,
- agregaty krajow i powrotow przeniesione do `stats_countries.py`,
- agregaty jakosci danych i listy brakow przeniesione do `stats_quality.py`,
- agregaty Hall of Fame przeniesione do `stats_hall_of_fame.py`,
- `stats.py` pozostaje odpowiedzialny za glowne endpointy i pozostale agregaty,
- `45f26d7` dodal warstwe endpointow sekcyjnych bez przenoszenia calej logiki
  do nowych modulow.

**Propozycja:**
- wydzielic kolejne sekcje agregacji: koszty i glowne agregaty okresu,
- zachowac endpoint Flask w `stats.py` jako cienka warstwe HTTP.

**Weryfikacja:** dodanie nowej statystyki nie wymaga edycji jednego bardzo duzego endpointu.

### 14a. Optymalizacja ciezszych agregatow i list - PARTIAL

**Problem:** po rozbudowie statystyk kilka miejsc moze stac sie kosztowne przy wiekszej bazie:
- `country_history` i `country_milestones` dotykaja podobnych danych o krajach,
- `/api/locations` liczy `visit_count` przez join z lokacjami podrzednymi i `COUNT(DISTINCT)`,
- `_period_stats(year)` bywa liczony dwa razy przy porownaniu rok do roku.

**Do rozwazenia pozniej:**
- zrobione w `Optimize stats query budget`: lekki `_period_overview(year - 1)` dla porownania rok do roku, wspolna baza danych okresu w `_period_base()`, kosztowe rankingi bez dodatkowych SQL i Hall of Fame liczony z trzech zapytan zamiast dziesieciu,
- zrobione w `Add stats overview endpoint` i `Load stats overview first`: osobny lekki endpoint dla Podsumowania i frontendowe overview-first loading,
- zrobione w `45f26d7`: sekcyjne endpointy dla kosztow, krajow, uczestnikow,
  jakosci i rocznika, zeby UI nie pobieral pelnego `/api/stats` przy kazdej
  zakladce,
- zrobione w `09c1f03` oraz pozniejszych passach: `/api/locations`,
  `/api/map-locations` i `/api/locations/todo` uzywaja preagregowanych CTE
  zamiast szerokiego `GROUP BY` jako podstawowej sciezki,
- polaczyc albo wspoldzielic dane miedzy `country_history` i `country_milestones`,
- dodac krotkotrwaly cache w request-scope dla pozostalych wspolnych agregatow, jesli pojawia sie realne lagi.

**Weryfikacja:** widoki Statystyki i Miejsca zachowuja ten sam kontrakt JSON, ale liczba lub koszt zapytan spada.

### 15. Role uzytkownikow: admin i viewer

**Problem:** aplikacja docelowo powinna wspierac dwa tryby dostepu:
- admin: widzi wszystko i moze zmieniac baze danych,
- viewer: moze ogladac dane, ale nie widzi kosztow, nie widzi widokow jakosci/brakow i nie moze wykonywac mutacji.

**Propozycja wdrozenia etapami:**
1. Dodac logowanie, sesje i role przez zmienne srodowiskowe, np. `SECRET_KEY`, `ADMIN_PASSWORD_HASH`, `VIEWER_PASSWORD_HASH`.
2. Zablokowac na backendzie `POST`, `PUT`, `PATCH`, `DELETE` dla viewerow.
3. Redagowac koszty po stronie backendu dla viewerow: `amount`, `currency`, `amount_by_currency`, `top_expensive`, `cost_per_day`, koszt w podgladzie/listach/statystykach/Hall of Fame.
4. Ukryc w UI przyciski i widoki administracyjne: dodawanie, edycje, usuwanie, kosz, backup, slowniki, jakosc danych, `Do uzupelnienia`, `Miejsca -> Braki`.
5. Poprawic PWA/cache: przy login/logout albo zmianie roli czyscic cache/IndexedDB albo kluczowac cache rola. Viewer nie moze zobaczyc danych admina z cache.

**Weryfikacja:**
- admin widzi koszty i moze edytowac,
- viewer nie dostaje kosztow nawet w JSON API,
- viewer nie moze zapisac/usunac przez API,
- po przelogowaniu admin -> viewer stare dane z cache nie pokazuja kosztow.

### 16. Kreator podrozy - bezpieczny zapis koncowy - DONE

**Kontekst:** nie zmieniac zasady, ze mozna swiadomie zapisac niepelna podroz. Problemem jest tylko sytuacja, gdy klik "Zapisz podroz" technicznie utworzy podroz, ale nie dopnie wszystkich miejsc/uczestnikow.

**Status:** zrobione w `Add transactional wizard save`.

**Zrobione:**
- dodany endpoint `POST /api/travels/wizard` zapisujacy podroz, miejsca i uczestnikow w jednej transakcji,
- kreator wysyla jeden finalny payload zamiast tworzyc podroz i dopinac relacje osobnymi requestami,
- bledy dopinania miejsc/uczestnikow powoduja rollback calego zapisu,
- dodane testy sukcesu, rollbacku oraz odrzucenia wizyty poza zakresem bez zapisu do bazy.

**Weryfikacja:** w kreatorze utworzyc podroz z miejscem i uczestnikiem; po zapisie szczegoly podrozy powinny pokazac oba powiazania. Przy technicznym bledzie dopiecia relacji podroz nie powinna zostac czesciowo utworzona.

### 17. Aktualizacja dokumentacji technicznej - DONE

**Status:** zrobione w `fef84cf Update project documentation`.

**Weryfikacja:** nowy agent moze wejsc w repo i zrozumiec aktualny stan bez czytania historii commitow.

### 18. Audyt Claude Code 2026-06-11: wydajnosc list, rate-limit, frontend

**Status:** dopisane po przegladzie projektu (silne/slabe strony) z 2026-06-11. Partia quick-winow zrobiona w `Harden HTTP layer: security headers, ProxyFix, SECRET_KEY warning`: naglowki bezpieczenstwa (CSP, nosniff, X-Frame-Options, Referrer-Policy, HSTS), `ProxyFix` na Renderze i ostrzezenie o braku `SECRET_KEY`. Ponizsze trzy tematy zostaly swiadomie odlozone jako wieksze, bo wymagaja realnej zmiany w warstwie danych albo frontendzie.

**18a. Paginacja list i odchudzenie `get_locations` - PARTIAL**

**Problem:** `/api/travels` i `/api/locations` zwracaja cala tabele przy
kazdym renderze listy. Czesc dotyczaca kosztownego liczenia `visit_count`
zostala juz poprawiona przez CTE/preagregacje, ale brak paginacji nadal moze
stac sie problemem przy znacznie wiekszej bazie.

**Propozycja:**
- dodac paginacje albo limit + lazy load do list podrozy i miejsc,
- utrzymac istniejacy CTE/agregacje wizyt jako kontrakt wydajnosciowy,
- zachowac istniejacy kontrakt JSON i wyszukiwanie `q`.

**Weryfikacja:** lista podrozy i miejsc renderuje sie z ograniczonym zestawem rekordow, a liczba/koszt zapytan w `get_locations` spada bez zmiany wygladu.

**18b. Rate-limiter logowania odporny na wiele workerow**

**Problem:** `_auth_failures` w `app.py` trzyma stan blednych logowan w slowniku w pamieci procesu. Przy wiecej niz jednym workerze gunicorn kazdy worker liczy proby osobno, wiec lockout jest niespojny i latwiejszy do obejscia. Stan ginie tez przy restarcie/redeployu.

**Propozycja:**
- albo wymusic 1 workera i udokumentowac to jako swiadoma decyzja,
- albo przeniesc licznik prob do wspolnego magazynu (np. Redis) lub do tabeli w PostgreSQL z krotkim TTL,
- zachowac obecny kontrakt 429 + `Retry-After`.

**Weryfikacja:** lockout dziala spojnie niezaleznie od liczby workerow i przezywa restart procesu.

**18c. Odchudzenie frontendu: podzial plikow, delegacja zdarzen, zaleznosci**

**Problem:** UI jest budowane glownie ze stringow HTML z inline `onclick`, co dziala dzieki `jsStringArg`/`escapeAttr`, ale jest kruche i wymusza recznene uciekanie w kazdym miejscu. `app.css` ma ~2200 linii, `locations.js` ~1100 linii w jednym pliku. Zaleznosci sa lekko przestarzale.

**Propozycja:**
- stopniowo zastepowac inline `onclick` delegacja zdarzen (powiazane z 10 i P4/16),
- selektywnie dzielic `app.css` i `locations.js` po wyraznych sekcjach odpowiedzialnosci,
- podbic zaleznosci (`flask`, `psycopg2-binary`, `pydantic`, `gunicorn`) po sprawdzeniu changelogow,
- usunac duplikacje typu `L.tileLayer(...)` z `map.js` i `stats.js`.

**Zasada:** male, bezpieczne ciecia bez migracji na framework; po kazdym kroku smoke JS i testy kontraktowe musza przechodzic.

**Weryfikacja:** rozmiar plikow i liczba inline handlerow spada, a wyglad/UX pozostaje bez zmian.

**18d. Krok operacyjny: `SECRET_KEY` w env Rendera**

**Problem:** kod ostrzega w logach, gdy `SECRET_KEY` nie jest ustawiony (`Harden HTTP layer: ...`), ale samo ostrzezenie nie rozwiazuje sprawy. Dopoki zmienna nie jest ustawiona na stala wartosc w Environment na Render, kazdy redeploy/restart losuje nowy klucz i wylogowuje admina.

**Do zrobienia (poza kodem, w panelu Render):**
- wygenerowac klucz: `python -c "import secrets; print(secrets.token_hex(32))"`,
- dodac `SECRET_KEY` w Render -> Environment (zapis env-var wyzwala redeploy),
- ustawic raz i nie zmieniac pozniej (zmiana tez wylogowuje wszystkich),
- potwierdzic, ze ostrzezenie `[auth] WARNING: SECRET_KEY not set ...` znika z logow startu.

**Weryfikacja:** po ustawieniu zmiennej zalogowana sesja admina przezywa redeploy/restart Rendera bez wylogowania.

## P4 - Pomysly pozniejsze

### 13. Import/eksport danych przyjazny dla czlowieka

CSV/JSON dla podrozy, miejsc, uczestnikow i statystyk. Pierwszy krok backupu JSON z metadanymi jest zrobiony w `Harden backup and sensitive cache`; import oraz przyjazne formaty czastkowe zostaja na pozniej.

### 14. Zdjecia i albumy

Lekkie powiazanie podrozy z albumem/linkiem albo statusem albumu.

### 15. Usprawnienie PWA offline

Lepsze komunikaty, kiedy dane pochodza z cache, oraz reczne "odswiez dane".

### 16. Dalsze porzadkowanie kodu frontendu

**Status:** czesciowo zaczete. W `Split stats yearbook renderer` rocznik statystyk zostal przeniesiony ze `stats.js` do `static/js/stats_yearbook.js`, bez zmiany UI i bez migracji na moduly.
Dodatkowo `45f26d7` rozbil ladowanie danych Statystyk na sekcyjne endpointy,
wiec dalszy podzial `stats.js` powinien wynikac z utrzymania kodu, nie z
wydajnosci pierwszego renderu.

**Kierunek:** robic tylko selektywne, male ciecia tam, gdzie plik ma wyrazna sekcje odpowiedzialnosci:
- w `stats.js`: dalsze renderery typu kraje/koszty/jakosc, jesli zaczna
  przeszkadzac w utrzymaniu,
- w `locations.js`: osobno lista/filtrowanie, szczegoly miejsca, formularze/modale i kosz/narzedzia,
- w `components.js`: tylko helpery naprawde uzywane w wielu miejscach.

**Zasada:** nie migrowac na framework i nie budowac duzego systemu komponentow. Refaktor ma zmniejszac rozmiar plikow i liczbe rzeczy trzymanych w glowie, a nie produkowac abstrakcje uzywane w kilku przypadkach.

**Weryfikacja:** po kazdym malym podziale wyglad UI zostaje bez zmian, a smoke JS/testy kontraktowe przechodza.

### 17. Historia / Rocznik podrozy - PARTIAL

Pierwszy etap zrobiony w `Add stats yearbook`: backend zwraca `yearbook`, a Statystyki maja sekcje Rocznik z latami jako rozdzialami, najwazniejszymi podrozami roku, nowymi krajami, powrotami i najbardziej wypelnionym miesiacem.
Dopiete pozniej w `64ad250 Enhance travel yearbook`: krotka narracja roku,
`featured_trip`, rytm miesiecy i pelniejsze liczniki nowych/powrotnych krajow.

Do dopracowania pozniej tylko jesli widok ma stac sie bardziej pamiatkowy:
tryb wydruku/eksportu jednego roku, deep link do konkretnego roku, ewentualnie
porownania rok do roku albo dluzsze przerwy miedzy powrotami.

### 18. Menu aplikacji dla ustawien sesji - DONE

**Status:** zrobione w `Add app session menu`.

**Kontekst:** po dodaniu logowania przyciski `Wyloguj` i przelacznik motywu sa globalnymi kontrolkami nakladanymi na widoki. Po poprawkach nie powinny blokowac `Narzedzi`, ale na iPhonie i w przyszlych widokach taki uklad nadal bedzie wygladal jak techniczny dodatek.

**Propozycja:** zastapic osobne plywajace przyciski jednym malym menu aplikacji, np. ikona/profil w naglowku albo pozycja w narzedziach. Menu moze zawierac:
- przelacznik motywu,
- wylogowanie,
- w przyszlosci backup/status synchronizacji/informacje o aplikacji.

**Weryfikacja:** na iPhonie i desktopie globalne akcje sesji sa dostepne, ale nie nachodza na akcje konkretnych widokow, np. `Miejsca -> Narzedzia`.

### 19. Lagodne prowadzenie nowego uzytkownika

**Status:** pomysl na pozniej, bez pilnej implementacji.

**Kontekst:** aplikacja jest narzedziem osobistym i nie potrzebuje marketingowego onboardingu ani samouczka krok-po-kroku. Dla osoby, ktora pierwszy raz zaczyna wprowadzac dane, przydaloby sie jednak kilka dyskretnych podpowiedzi w pustych albo niepelnych widokach.

**Kierunek:**
- puste `Podroze`: komunikat "Dodaj pierwsza podroz" z akcja otwarcia kreatora,
- puste `Miejsca`: wyjasnienie, ze miejsca mozna dodawac osobno albo w trakcie tworzenia podrozy,
- szczegoly podrozy bez miejsc/uczestnikow/notatek: mala karta "nastepny sensowny krok",
- puste sekcje statystyk: konkretne informacje, jakie dane trzeba uzupelnic, zeby statystyka zaczela miec sens,
- podpowiedzi powinny znikac, gdy dane juz istnieja.

**Zasada:** nie dodawac modali onboardingowych, checklist na sile ani rozbudowanych samouczkow. Ma to byc lekkie prowadzenie w miejscu pracy, widoczne tylko wtedy, gdy realnie pomaga.

**Weryfikacja:** nowy uzytkownik z pusta baza powinien zrozumiec, od czego zaczac, bez czytania dokumentacji i bez poczucia, ze aplikacja prowadzi go przez niepotrzebny kurs.
