# AGENTS.md

This file provides guidance to Codex, Claude, and other coding agents when working with this repository.

## Next Start

UI phase 4 zostala zrealizowana w `Unify wizard UI controls`.

Przy kolejnym uruchomieniu sprawdz najpierw `BACKLOG.md` i wybierz z uzytkownikiem kolejny praktyczny temat. Sensowne kandydaty:
- lepsze komunikaty bledow w UI,
- glebsza analityka krajow i powrotow,
- podzial ekranu statystyk na czytelniejsze sekcje,
- dalsze porzadkowanie wspolnych komponentow frontendu.

## Local Run

PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://..."  # connection string z Neon.tech
python -m pip install -r requirements.txt
python app.py                           # http://localhost:5000
```

Produkcja: Render.com startuje aplikacje przez `gunicorn app:app` z `Procfile`.
Zmienna `DATABASE_URL` musi byc ustawiona w Environment na Render.

Nie commitowac sekretow. Lokalny plik `connection string.txt`, `.env`, archiwa zip i `travel.sqlite` sa ignorowane przez Git.

## Verification

Przed commitem, zaleznnie od zakresu zmiany:

```powershell
python -m py_compile app.py core.py travels.py locations.py dicts.py stats.py schemas.py migrate.py
python -m ruff check .
git diff --check
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

Pelnych testow automatycznych jeszcze nie ma. Dla zmian UI konieczna jest krotka weryfikacja reczna w przegladarce po deployu.

## Architecture

**Backend** - Flask + PostgreSQL, podzielony na moduly:

| File | Responsibility |
|------|----------------|
| `app.py` | bootstrap Flask, blueprints, `/`, `/sw.js`, `/api/trash`, `/api/export`, `/healthz` |
| `core.py` | DB connection, `query()`, `execute()`, ETag JSON, validation errors, idempotent schema migrations |
| `schemas.py` | Pydantic validation schemas |
| `travels.py` | `/api/travels`, CRUD podrozy, miejsca w podrozy, uczestnicy |
| `locations.py` | `/api/locations`, miejsca, hierarchia miejsc, GPS, restore, mapa |
| `dicts.py` | slowniki (`countries`, `location_types`, `relation_types`) i `persons` |
| `stats.py` | `/api/stats`, `/api/stats/todo`, agregaty, Hall of Fame, jakosc danych |
| `migrate.py` | pomocnicze migracje/utrzymanie bazy |

`ensure_schema()` w `core.py` uruchamia idempotentne migracje przy starcie procesu, zeby deploy na Render nie wymagal recznych krokow.

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

Standardowy przeplyw po zmianach:

```powershell
git add <files>
git commit -m "<message>"
git push origin main
```

Render automatycznie przebudowuje aplikacje z brancha `main`.
Po kazdym commicie podawac uzytkownikowi konkretne kroki weryfikacji po deployu.
