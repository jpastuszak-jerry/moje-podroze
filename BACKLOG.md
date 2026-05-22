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

**Do rozwazenia:** podzial statystyk na sekcje lub podzakladki:
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

**Do zrobienia dalej:**
- przeniesc style formularzy i geokodowania z inline CSS do klas,
- ujednolicic przyciski zapisu/anulowania w modalach,
- uporzadkowac akcje kosza i slownikow.

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

## P3 - Stabilnosc, bezpieczenstwo, architektura

### 9. Testy automatyczne dla logiki dat i statystyk - PARTIAL

**Problem:** najwazniejsza logika domenowa jest obecnie weryfikowana glownie recznie. Dotyczy to szczegolnie statystyk, dat i jakosci danych.

**Status:** pierwszy pakiet smoke testow dodany w `Add automated smoke tests`, uzupelniony o kontrakty API w `Add API contract smoke tests`.

**Zrobione:**
- Python `unittest` dla inkluzywnego liczenia dni, przycinania podrozy do roku i walidacji Pydantic,
- JS smoke testy dla `daysCount`, polgwiazdek, komunikatow API, blokady podwojnych akcji, `removeWithSlide` i przycinania dat pobytu,
- minimalne testy kontraktu `/api/stats`, `/api/stats/todo` i `/api/locations/todo`,
- GitHub Actions uruchamiaja testy Python i JS przy pushu.

**Do dodania dalej:**
- testy jakosci danych podrozy,
- testy jakosci danych miejsc,
- testy nowych/powrotnych krajow,
- glebsze testy kontraktow z realistycznym zestawem danych statystyk,
- docelowo testy z mala baza testowa albo mockiem warstwy `query()`.

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

### 14a. Optymalizacja ciezszych agregatow i list

**Problem:** po rozbudowie statystyk kilka miejsc moze stac sie kosztowne przy wiekszej bazie:
- `country_history` i `country_milestones` dotykaja podobnych danych o krajach,
- `/api/locations` liczy `visit_count` przez join z lokacjami podrzednymi i `COUNT(DISTINCT)`,
- `_period_stats(year)` bywa liczony dwa razy przy porownaniu rok do roku.

**Do rozwazenia pozniej:**
- polaczyc albo wspoldzielic dane miedzy `country_history` i `country_milestones`,
- uproscic `/api/locations` przez CTE albo osobny maly SELECT agregujacy wizyty,
- dodac krotkotrwaly cache w request-scope dla `_period_stats(year)`, jesli pojawia sie realne lagi.

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

### 17. Historia / Rocznik podrozy

Lepszy nastepca usunietej osi czasu: widok narracyjny w Statystykach, ktory pokazuje lata jako rozdzialy, najwazniejsze podroze roku, nowe kraje, powroty po latach, najdluzsze przerwy i miesiace najbardziej wypelnione podrozami.
