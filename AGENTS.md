# AGENTS.md

This file provides guidance to Codex, Claude, and other coding agents when working with this repository.

## Next Start

Najpierw przeczytaj `CURRENT_STATE.md`. To jest krotki stan projektu na start
sesji i ma ograniczac koniecznosc ladowania calego backlogu do kontekstu.

Potem, jesli trzeba szczegolow historycznych albo wyboru nastepnego tematu,
sprawdz `BACKLOG.md`. Aktualnie sensowne kierunki sa zapisane w
`CURRENT_STATE.md`.

## Current State Maintenance

Przed koncowa odpowiedzia po zakonczonej pracy, commicie, pushu, deployu albo
zmianie priorytetow sprawdz, czy `CURRENT_STATE.md` wymaga aktualizacji.
Aktualizuj go zawsze, gdy zmienily sie:
- ostatnio domknieta praca albo commit,
- wynik CI/deployu/smoke produkcji,
- lokalny dirty state istotny dla nastepnej sesji,
- najlepsze nastepne tematy,
- znane blokery, np. Node w PATH albo brak testowej bazy.

Nie przepisuj historii z `BACKLOG.md`; `CURRENT_STATE.md` ma byc krotkim
stanem operacyjnym na start kolejnego czatu.

## Local Run

PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://..."  # connection string z Neon.tech
python -m pip install -r requirements.txt
python app.py                           # http://localhost:5000
```

Produkcja: Render.com startuje aplikacje przez `gunicorn app:app` z `Procfile`.
Zmienna `DATABASE_URL` musi byc ustawiona w Environment na Render.

`SECRET_KEY` musi byc ustawiony na stala wartosc w Environment na Render. Bez
niego `app.py` losuje klucz przy starcie, co uniewaznia wszystkie sesje przy
kazdym redeployu/restarcie (admin jest wylogowywany). Kod wypisuje wtedy w
logach `[auth] WARNING: SECRET_KEY not set ...`. Wygeneruj raz przez
`python -c "import secrets; print(secrets.token_hex(32))"` i nie zmieniaj
pozniej (zmiana tez wylogowuje wszystkich).

Nie commitowac sekretow. Lokalny plik `connection string.txt`, `.env`, archiwa zip i `travel.sqlite` sa ignorowane przez Git.

## Verification

Przed commitem, zaleznnie od zakresu zmiany:

```powershell
python -m py_compile app.py core.py travels.py locations.py dicts.py stats.py schemas.py migrate.py schema_migrations.py
python -m py_compile stats_common.py stats_countries.py stats_quality.py stats_hall_of_fame.py stats_yearbook.py
python -m ruff check .
python -m unittest discover -s tests
git diff --check
```

Opcjonalny test integracyjny PostgreSQL jest pomijany bez `TEST_DATABASE_URL`.
Uruchamia sie na tymczasowym schemacie i sprzata go po sobie:

```powershell
$env:TEST_DATABASE_URL = "postgresql://..."
python -m unittest tests.test_postgres_integration
```

Przy zmianach JS sprawdzic skladnie zmienionych plikow, np.:

```powershell
node --check static/js/utils.js
node --check static/js/travels.js
node --check static/js/locations.js
node --check static/js/wizard.js
node --check static/js/stats.js
node --check static/js/todo.js
node --check static/js/map.js
node --check static/js/dictionaries.js
node --check static/js/persons.js
```

Przy zmianach wspolnych helperow frontendu uruchomic:

```powershell
node tools/smoke_js.mjs
```

Po deployu na Renderze uruchomic bezsekretowy smoke produkcji:

```powershell
python tools/smoke_prod.py
```

Skrypt domyslnie sprawdza `https://moje-podroze.onrender.com`: `/healthz`,
build/commit SHA z healthchecka, naglowki bezpieczenstwa i CSP dla mapy
(`connect-src` musi dopuszczac `unpkg.com`), shell aplikacji, status auth,
blokade `/api/travels` bez sesji, `/sw.js`, manifest PWA i kluczowe ikony.

Pelnych testow automatycznych jeszcze nie ma, ale repo ma pierwszy pakiet smoke testow Python/JS. Dla zmian UI nadal konieczna jest krotka weryfikacja reczna w przegladarce po deployu.

Przy kazdej zmianie typu refactoring agent musi:
- jasno opisac korzysci: co bedzie prostsze, stabilniejsze, szybsze albo latwiejsze w utrzymaniu,
- przygotowac smoke testy: minimalny zestaw recznych lub automatycznych krokow, ktore potwierdzaja, ze kluczowe zachowania po refaktoringu nadal dzialaja,
- podac te smoke testy uzytkownikowi po commicie jako konkretna instrukcje weryfikacji.

## Architecture

**Backend** - Flask + PostgreSQL, podzielony na moduly:

| File | Responsibility |
|------|----------------|
| `app.py` | bootstrap Flask, blueprints, `/`, `/sw.js`, `/api/trash`, `/api/export`, `/healthz` |
| `core.py` | DB connection, `query()`, `execute()`, ETag JSON, validation errors, startup migration runner |
| `schema_migrations.py` | wersjonowane migracje schematu uruchamiane przez `ensure_schema()` |
| `schemas.py` | Pydantic validation schemas |
| `travels.py` | `/api/travels`, CRUD podrozy, miejsca w podrozy, uczestnicy |
| `locations.py` | `/api/locations`, miejsca, hierarchia miejsc, GPS, restore, mapa |
| `dicts.py` | slowniki (`countries`, `location_types`, `relation_types`) i `persons` |
| `stats.py` | `/api/stats`, `/api/stats/todo`, glowne agregaty i skladanie odpowiedzi |
| `stats_common.py` | wspolne helpery dat i zakresow statystyk |
| `stats_countries.py` | agregaty historii krajow, nowych krajow i powrotow |
| `stats_quality.py` | agregaty jakosci danych i listy brakow w podrozach |
| `stats_hall_of_fame.py` | agregaty Hall of Fame dla statystyk |
| `migrate.py` | pomocnicze migracje/utrzymanie bazy |

`ensure_schema()` w `core.py` uruchamia wersjonowane migracje z `schema_migrations.py` przy starcie procesu, zeby deploy na Render nie wymagal recznych krokow.

**Frontend** - vanilla JS SPA bez frameworka. `templates/index.html` jest shellem z dolna nawigacja i tagami `<script>`.

| File | Responsibility |
|------|----------------|
| `utils.js` | API helpers, escape helpers, daty, ikony, modal helpers, `showTab()` |
| `travels.js` | lista podrozy i szczegoly podrozy |
| `locations.js` | lista miejsc, szczegoly miejsca, geokodowanie, kosz |
| `wizard.js` | multi-step wizard tworzenia podrozy |
| `map.js` | Leaflet + MarkerCluster |
| `stats.js` | ekran statystyk |
| `todo.js` | widoki "Do uzupelnienia" dla podrozy i miejsc |
| `dictionaries.js` | CRUD slownikow |
| `persons.js` | CRUD uczestnikow |

Dolna nawigacja ma glowne zakladki: `travels`, `locations`, `map`, `stats`.
Widoki pomocnicze `todo` i `locationTodo` sa otwierane z poziomu statystyk.
Oś czasu jako osobna zakladka zostala usunieta.

## Key Patterns

**Wizard state** - stan kreatora jest trzymany w `wizardState`, a nie w elementach DOM.
Przy re-renderze trzeba zachowac m.in. `wizardState.allLocs`, `countries`, `locTypes`, `relTypes`.

**Wizard overlays** - sub-overlaye kreatora sa appendowane do `document.body`.
`closeWizard()` musi sprzatac overlaye typu `#wiz-loc-date-overlay` i `#wiz-new-loc-overlay`.

**Dates and duration** - dni podrozy liczone sa inkluzywnie: wyjazd 11 lipca i powrot 12 lipca to 2 dni.
Ta sama konwencja ma obowiazywac w podgladach, statystykach i pobytach.

**Ratings** - oceny podrozy sa w skali 0.5-5.0 co 0.5.
Gwiazdki renderuje helper `stars()` w `static/js/utils.js`; nie wracac do tekstowych polgwiazdek.

**Soft delete** - podroze i miejsca maja `deleted_at`.
Usuniecie jest miekkie, a przywracanie/kosz obsluguja endpointy restore i `/api/trash`.

**Database** - PostgreSQL na Neon.tech.
`query()` zwraca `RealDictRow`, `execute()` commitowuje transakcje i zwraca `RETURNING id` albo `None`.
Kazdy request dostaje polaczenie przez `g.db`, zamykane w `teardown_appcontext`.

**Stats participants** - statystyki uczestnikow nie powinny zakladac hardkodowanych `person_id`.
Liczyc z tabel `persons` i `travel_participants`.

## Database Schema

```text
countries, location_types, relation_types   - slowniki (id, name)
locations      - miejsca (country_id, location_type_id, parent_location_id?, latitude?, longitude?, deleted_at?)
persons        - uczestnicy (relation_type_id?)
travels        - podroze (start_date, end_date, amount, currency, rating, deleted_at?, ...)
travel_locations    - M:N travels <-> locations (arrival_date, departure_date, notes)
travel_participants - M:N travels <-> persons
```

Lokacje obsluguja hierarchie przez `parent_location_id` (np. dzielnica -> miasto).
Widok miejsca pokazuje bezposrednie wizyty i wizyty przez lokacje podrzedne (`child_visits`).

## Deployment

Domyslny sposob domkniecia kazdej gotowej zmiany aplikacyjnej:

1. Uruchom adekwatne testy lokalne i `git diff --check`.
2. Jesli testy przechodza, zacommituj tylko pliki nalezace do biezacego zadania
   i wypchnij commit na `main`.
3. Poczekaj na GitHub Actions i automatyczny deploy Render; sprawdz, czy CI
   zakonczylo sie sukcesem i czy `/healthz` pokazuje SHA nowego commita.
4. Uruchom `python tools/smoke_prod.py`.
5. Dla zmian UI wykonaj, o ile pozwala na to dostepna sesja, krotki smoke
   zmienionego flow w przegladarce. Brak zalogowanej sesji lub niedostepnosc
   Browsera trzeba jawnie zapisac jako ograniczenie, ale nie pomijac przez to
   CI ani bezsekretowego smoke produkcji.
6. Dopiero potem podaj odpowiedz koncowa z commitem, wynikiem CI/deployu i
   konkretnymi krokami recznej kontroli dla uzytkownika.

Nie zatrzymuj gotowej, przetestowanej zmiany jako lokalnej tylko po to, by
czekac na osobna prosbe o commit lub push. Wyjatkiem jest wyrazne polecenie
uzytkownika, zeby nie commitowac/nie wdrazac, albo realny bloker wymagajacy
decyzji lub dodatkowych uprawnien. Nie dolaczaj do commita cudzych ani
niezwiazanych lokalnych zmian.

Polecenia standardowego przeplywu:

```powershell
git add <files>
git commit -m "<message>"
git push origin main
```

Render automatycznie przebudowuje aplikacje z brancha `main`.
Po kazdym deployu podawac uzytkownikowi konkretne kroki weryfikacji produkcji.
