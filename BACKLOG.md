# Backlog

Lista rzeczy do zrobienia po ostatnich pracach nad statystykami, lista "Do uzupelnienia" i poprawkami stabilnosci. Priorytety sa praktyczne: najpierw rzeczy, ktore zwiekszaja wiarygodnosc danych i wygode pracy, potem wieksze zmiany architektoniczne.

## P0 - Pilne po audycie architektury

### 0. Audyt Claude Code 2026-05-28: bezpieczenstwo i fundamenty - PARTIAL

**Status:** dopisane po analizie zrzutow `Co jest dobrze/slabe/Rekomendacja i ocena 2026-05-28` oraz szybkim sprawdzeniu aktualnego kodu. Pierwsza partia P0 zrobiona w `Improve database and stats performance`: connection pooling, indeksy relacji/aktywnych rekordow i krotki cache TTL dla `/api/stats` uniewazniany po zapisach. Druga partia P0 zrobiona w `Harden frontend and data constraints`: XSS audit najczestszych select/input rendererow, jedno zrodlo polityki `no-store` oraz `Decimal`/CHECK constraints dla danych domenowych. Trzecia partia P0 zrobiona w `Add admin-only authentication`: logowanie admin-only haslem z env, sesja Flask, blokada prywatnego API, ekran login/logout i czyszczenie cache/IDB przy wylogowaniu.

**Z czym sie zgadzam i podnosze do najwyzszego priorytetu:**
1. Auth natychmiast - PARTIAL (admin-only DONE). Aplikacja ma juz logowanie admin-only, sesje, blokade prywatnego API i rate limit blednych logowan. Do zrobienia pozniej: pelne role admin/viewer, redakcja kosztow dla viewerow i ukrywanie widokow administracyjnych.
2. Connection pooling - DONE. `core.get_db()` korzysta z `psycopg2.pool.ThreadedConnectionPool` zamiast otwierac nowe polaczenie per request. Rozmiar puli mozna ustawic przez `DB_POOL_MINCONN` i `DB_POOL_MAXCONN`.
3. Migracje wersjonowane - DONE. `ensure_schema()` nadal zachowuje zasade "no manual steps after deploy", ale deleguje prace do `schema_migrations.py`: migracje maja wersje, nazwy i zapis w tabeli `schema_migrations`. Wybrany zostal prosty wlasny system zamiast Alembic, bo pasuje do malej aplikacji i deployu na Renderze bez dodatkowych komend.
4. Indeksy FK i partial indexes - DONE. `ensure_schema()` tworzy idempotentnie indeksy pod relacje i aktywne rekordy, szczegolnie `travel_locations(travel_id)`, `travel_locations(location_id)`, `travel_participants(travel_id/person_id)`, `locations(parent_location_id)`, `locations(country_id)`, `travels(start_date) WHERE deleted_at IS NULL` i `locations(country_id) WHERE deleted_at IS NULL`.
5. Budzet zapytan dla `/api/stats` - PARTIAL. Endpoint nadal sklada wiele agregatow w jednym kontrakcie, ale ma teraz krotki cache TTL (`STATS_CACHE_TTL_SECONDS`, domyslnie 60s) z uniewaznianiem po zapisach. Dodatkowo w `Optimize stats query budget` zimny budzet `/api/stats?year=...` zostal obnizony orientacyjnie z ok. 42 do ok. 23 zapytan: poprzedni rok liczy lekki overview, rankingi kosztow korzystaja z pobranych juz podrozy, a Hall of Fame spadl z 10 do 3 zapytan. W `Add stats overview endpoint` i `Load stats overview first` dodany zostal lekki `/api/stats/overview`, a frontend uzywa go dla pierwszej sekcji Podsumowanie. Kolejny krok: sekcyjne endpointy dla kosztow/krajow/jakosci oraz realny pomiar czasow na produkcji.
6. Audyt XSS w frontendzie - DONE. Dynamiczne opcje selectow i wartosci inputow w miejscach/osobach/podrozach/mapie/kreatorze ida przez `renderSelectOptions()` i `escapeAttr()` zamiast lokalnych template stringow albo recznego `replace(/"/g, '&quot;')`.
7. Jedno zrodlo polityki `no-store` - DONE. Backendowe listy `NO_STORE_EXACT_API_PATHS` i `NO_STORE_API_PREFIXES` w `app.py` sa zrodlem prawdy, a `/sw.js` wstrzykuje je do service workera przy serwowaniu pliku.
8. Realniejsze testy integracyjne. Obecne testy kontraktu sa wartosciowe, ale mock SQL nie lapie regresji w zapytaniach. Dodac mala baze testowa, fixture PostgreSQL albo minimalny smoke na prawdziwym schemacie.
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
3. Zalogowac sie jako viewer i sprawdzic: brak kosztow w UI i JSON API, brak mozliwosci mutacji, brak widokow administracyjnych.
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

### 8b. Ujednolicenie UI - faza 1 - PARTIAL

**Status:** pierwsza faza zaczeta w `Unify basic UI controls`.

**Zrobione:**
- wspolne klasy CSS dla filtrow (`filter-grid`, `filter-select`) i malych akcji (`action-strip`, `action-button`, `icon-button`),
- podpiecie nowych klas w widoku Miejsca,
- podpiecie nowych klas w pasku narzedzi mapy.

**Do zrobienia dalej:**
- usunac kolejne inline style z formularzy i modalow,
- ujednolicic przyciski edycji/usuwania w szczegolach podrozy i miejsc,
- wydzielic najczestsze template stringi do lekkiego `components.js`,
- podzielic ekran Statystyk na czytelne sekcje.

**Weryfikacja:** filtry i przyciski narzedziowe w Miejscach oraz na Mapie wygladaja spojniej i korzystaja ze wspolnych klas.

### 8c. Ujednolicenie UI - faza 2 - PARTIAL

**Status:** kolejna faza zaczeta w `Unify detail action controls`.

**Zrobione:**
- wspolne klasy dla akcji w naglowkach sekcji (`section-actions`, `section-action`),
- wspolne klasy dla malych przyciskow w wierszach (`row-actions`, `row-icon-button`),
- uporzadkowanie przyciskow dodawania/mapy w szczegolach podrozy,
- uporzadkowanie przyciskow edycji/usuwania miejsc w podrozy,
- uporzadkowanie chipow uczestnikow,
- pierwsze wspolne klasy dla linkow i metadanych w szczegolach miejsc.
- dopiete pozniej w `Tidy auxiliary views`: kompaktowe filtry w widokach "Do uzupelnienia" i "Miejsca do uzupelnienia" oraz wspolne klasy wierszy i akcji Kosza.

**Do zrobienia dalej:**
- przeniesc style formularzy i geokodowania z inline CSS do klas,
- ujednolicic przyciski zapisu/anulowania w modalach,
- uporzadkowac pozostale akcje slownikow.

**Weryfikacja:** w szczegolach podrozy przyciski `Mapa`, `Dodaj`, edycja/usuwanie miejsc i usuwanie uczestnikow maja spojny wyglad.

### 8d. Ujednolicenie UI - faza 3

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

**Do dodania dalej:**
- testy jakosci danych podrozy,
- testy jakosci danych miejsc,
- testy nowych/powrotnych krajow,
- glebsze testy kontraktow z realistycznym zestawem danych statystyk,
- docelowo testy z mala baza testowa albo mockiem warstwy `query()`.

**Weryfikacja:** GitHub Actions uruchamia testy przy pushu i lapie regresje w statystykach.

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

**Weryfikacja:** `stats.js`, `todo.js`, `locations.js` i `travels.js` maja mniej duplikacji, a wyglad kart/filtrow pozostaje spojny.

### 11. Kontrakty API dla widokow - PARTIAL

**Problem:** endpointy zwracaja coraz bogatsze struktury, ale ich kontrakty sa opisane tylko przez kod.

**Status:** minimalne smoke testy kontraktu dodane w `Add API contract smoke tests`.

**Zrobione:**
- test kontraktu `/api/stats`,
- test kontraktu `/api/stats/todo`,
- test kontraktu `/api/locations/todo`.

**Do zrobienia dalej:**
- opisac odpowiedzi w dokumentacji technicznej,
- zastapic kruche mockowanie fragmentow SQL fixture'ami albo mala baza testowa,
- rozszerzyc kontrakty o dane bardziej realistyczne dla statystyk krajow, kosztow i jakosci danych.

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
- `stats.py` pozostaje odpowiedzialny za glowny endpoint i pozostale agregaty.

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
- polaczyc albo wspoldzielic dane miedzy `country_history` i `country_milestones`,
- uproscic `/api/locations` przez CTE albo osobny maly SELECT agregujacy wizyty,
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

## P4 - Pomysly pozniejsze

### 13. Import/eksport danych przyjazny dla czlowieka

CSV/JSON dla podrozy, miejsc, uczestnikow i statystyk. Pierwszy krok backupu JSON z metadanymi jest zrobiony w `Harden backup and sensitive cache`; import oraz przyjazne formaty czastkowe zostaja na pozniej.

### 14. Zdjecia i albumy

Lekkie powiazanie podrozy z albumem/linkiem albo statusem albumu.

### 15. Usprawnienie PWA offline

Lepsze komunikaty, kiedy dane pochodza z cache, oraz reczne "odswiez dane".

### 16. Dalsze porzadkowanie kodu frontendu

Wspolne komponenty dla kart, paskow filtrow, rankingow i pustych stanow, zeby zmniejszyc duplikacje w `travels.js`, `stats.js`, `todo.js` i `locations.js`.

### 17. Historia / Rocznik podrozy - PARTIAL

Pierwszy etap zrobiony w `Add stats yearbook`: backend zwraca `yearbook`, a Statystyki maja sekcje Rocznik z latami jako rozdzialami, najwazniejszymi podrozami roku, nowymi krajami, powrotami i najbardziej wypelnionym miesiacem.

Do dopracowania pozniej: bardziej narracyjne opisy roczne, dluzsze przerwy miedzy powrotami oraz ewentualne porownania rok do roku w ramach rocznika.

### 18. Menu aplikacji dla ustawien sesji

**Kontekst:** po dodaniu logowania przyciski `Wyloguj` i przelacznik motywu sa globalnymi kontrolkami nakladanymi na widoki. Po poprawkach nie powinny blokowac `Narzedzi`, ale na iPhonie i w przyszlych widokach taki uklad nadal bedzie wygladal jak techniczny dodatek.

**Propozycja:** zastapic osobne plywajace przyciski jednym malym menu aplikacji, np. ikona/profil w naglowku albo pozycja w narzedziach. Menu moze zawierac:
- przelacznik motywu,
- wylogowanie,
- w przyszlosci backup/status synchronizacji/informacje o aplikacji.

**Weryfikacja:** na iPhonie i desktopie globalne akcje sesji sa dostepne, ale nie nachodza na akcje konkretnych widokow, np. `Miejsca -> Narzedzia`.
