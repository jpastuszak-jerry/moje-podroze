# Backlog

Lista rzeczy do zrobienia po ostatnich pracach nad statystykami, lista "Do uzupelnienia" i poprawkami stabilnosci. Priorytety sa praktyczne: najpierw rzeczy, ktore zwiekszaja wiarygodnosc danych i wygode pracy, potem wieksze zmiany architektoniczne.

## P1 - Najblizsze

### 1. Szybka edycja z listy "Do uzupelnienia" - DONE

**Status:** zrobione w `424c743 Add quick edit from completion list`.

**Weryfikacja:** w Statystyki -> Jakosc danych -> Lista klik "Edytuj" przy podrozy; powinien otworzyc sie formularz tej podrozy.

### 2. Dalsze rekordy w Hall of Fame - DONE

**Status:** zrobione w `7211d05 Expand stats hall of fame`.

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

### 4. Kraje i powroty - glebsza analityka

**Do dodania:**
- pierwsza wizyta w kazdym kraju,
- ostatnia wizyta w kazdym kraju,
- najdluzsza przerwa od ostatniej wizyty,
- kraje odwiedzane najregularniej,
- kraje tylko raz odwiedzone.

**Weryfikacja:** po wyborze roku widac nie tylko nowe/powrotne kraje, ale tez kontekst historii wizyt.

## P2 - UX i praca z danymi

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
- liczba wizyt i ostatnia wizyta na kafelkach miejsc.

**Weryfikacja:** lista miejsc pozwala szybko znalezc np. wszystkie miasta w Finlandii bez wspolrzednych.

### 7. Lepsze komunikaty bledow w UI

**Problem:** API coraz czesciej zwraca sensowne 404/409, ale frontend nie wszedzie pokazuje precyzyjna informacje.

**Do poprawy:**
- delete/restore dla podrozy i miejsc,
- bledy walidacji Pydantic,
- bledy offline/service worker,
- komunikaty przy czesciowym lub nieudanym zapisie.

**Weryfikacja:** wymuszone bledy API pokazuja uzytkownikowi zrozumialy toast albo stan pusty, a nie cichy brak reakcji.

### 8. Profesjonalizacja ekranu statystyk

**Do rozwazenia:** podzial statystyk na sekcje lub podzakladki:
- Podsumowanie,
- Kraje i miejsca,
- Koszty,
- Uczestnicy,
- Jakosc danych.

**Weryfikacja:** ekran jest mniej dlugi i latwiej znalezc konkretna analize.

## P3 - Stabilnosc, bezpieczenstwo, architektura

### 9. Testy automatyczne dla logiki dat i statystyk

**Problem:** najwazniejsza logika domenowa jest obecnie weryfikowana glownie recznie. Dotyczy to szczegolnie statystyk, dat i jakosci danych.

**Do dodania:**
- testy liczenia dni inkluzywnie,
- testy podrozy przechodzacej przez granice roku,
- testy jakosci danych podrozy,
- testy jakosci danych miejsc,
- testy nowych/powrotnych krajow,
- testy kontraktu `/api/stats`, `/api/stats/todo`, `/api/locations/todo`.

**Weryfikacja:** GitHub Actions uruchamia testy przy pushu i lapie regresje w statystykach.

### 10. Wspolne komponenty frontendu

**Problem:** frontend coraz czesciej sklada podobne elementy recznie w template stringach. Powtarzaja sie karty, badge, paski filtrow, puste stany, metryki i rankingowe belki.

**Propozycja:** dodac lekki `static/js/components.js` bez frameworka, np.:
- `renderCard`,
- `renderFilterBar`,
- `renderBadges`,
- `renderMetricCard`,
- `renderRankingBars`.

**Weryfikacja:** `stats.js`, `todo.js`, `locations.js` i `travels.js` maja mniej duplikacji, a wyglad kart/filtrow pozostaje spojny.

### 11. Kontrakty API dla widokow

**Problem:** endpointy zwracaja coraz bogatsze struktury, ale ich kontrakty sa opisane tylko przez kod.

**Do zrobienia:**
- opisac odpowiedzi `/api/stats`,
- opisac odpowiedzi `/api/stats/todo`,
- opisac odpowiedzi `/api/locations/todo`,
- najlepiej dodac testy sprawdzajace minimalny kontrakt.

**Weryfikacja:** nowy agent albo przyszly refaktor wie, ktore pola sa wymagane przez UI.

### 12. Strategia cache/PWA pod dane wrazliwe

**Problem:** service worker i IndexedDB cache sa bardzo przydatne, ale przy rolach uzytkownikow moga pokazac viewerowi dane admina, jesli cache nie bedzie rozdzielony lub czyszczony.

**Do zrobienia przed rolami viewer/admin:**
- zdecydowac, ktore endpointy moga byc cache'owane,
- dane z kosztami oznaczyc jako `no-store` albo cache'owac per rola,
- czyscic cache/IndexedDB przy login/logout,
- upewnic sie, ze viewer po przelogowaniu nie widzi kosztow z poprzedniej sesji admina.

**Weryfikacja:** test reczny admin -> logout -> viewer nie pokazuje kosztow ani danych administracyjnych.

### 13. Migracje bazy danych

**Problem:** obecnie schemat jest utrzymywany przez helpery startowe i `migrate.py`. Przy rolach, ustawieniach, albumach albo kolejnych tabelach bedzie potrzebny bezpieczniejszy mechanizm zmian schematu.

**Propozycja:**
- wprowadzic Alembic albo prosty wlasny system migracji wersjonowanych,
- zostawic `migrate.py --force` tylko do pelnej migracji SQLite -> PostgreSQL,
- dokumentowac migracje w repo.

**Weryfikacja:** zmiana schematu moze byc odpalona deterministycznie na lokalnym srodowisku i Renderze.

### 14. Wydzielenie agregacji statystyk

**Problem:** `stats.py` zawiera coraz wiecej zapytan analitycznych. To nadal dziala, ale plik bedzie trudny do utrzymania, jesli statystyki dalej beda rosly.

**Propozycja:**
- wydzielic helpery/sekcje agregacji, np. `stats_queries.py` albo klasy/funkcje per obszar: koszty, kraje, jakosc danych, Hall of Fame,
- zachowac endpoint Flask w `stats.py` jako cienka warstwe HTTP.

**Weryfikacja:** dodanie nowej statystyki nie wymaga edycji jednego bardzo duzego endpointu.

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

### 16. Kreator podrozy - bezpieczny zapis koncowy

**Kontekst:** nie zmieniac zasady, ze mozna swiadomie zapisac niepelna podroz. Problemem jest tylko sytuacja, gdy klik "Zapisz podroz" technicznie utworzy podroz, ale nie dopnie wszystkich miejsc/uczestnikow.

**Propozycja:** dodac endpoint transakcyjny dla finalnego zapisu kreatora albo wykrywac nieudane dopiecia i jasno informowac uzytkownika.

**Weryfikacja:** przy bledzie dopinania miejsca/uczestnika aplikacja nie udaje pelnego sukcesu.

### 17. Aktualizacja dokumentacji technicznej - DONE

**Status:** zrobione w `fef84cf Update project documentation`.

**Weryfikacja:** nowy agent moze wejsc w repo i zrozumiec aktualny stan bez czytania historii commitow.

## P4 - Pomysly pozniejsze

### 13. Import/eksport danych przyjazny dla czlowieka

CSV/JSON dla podrozy, miejsc, uczestnikow i statystyk.

### 14. Zdjecia i albumy

Lekkie powiazanie podrozy z albumem/linkiem albo statusem albumu.

### 15. Usprawnienie PWA offline

Lepsze komunikaty, kiedy dane pochodza z cache, oraz reczne "odswiez dane".

### 16. Dalsze porzadkowanie kodu frontendu

Wspolne komponenty dla kart, paskow filtrow, rankingow i pustych stanow, zeby zmniejszyc duplikacje w `travels.js`, `stats.js`, `todo.js` i `locations.js`.
