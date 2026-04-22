# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Uruchamianie lokalnie

```bash
set DATABASE_URL=postgresql://...   # connection string z Neon.tech
pip install -r requirements.txt
python app.py                        # http://localhost:5000
```

Na produkcji (Render.com) startuje przez `gunicorn app:app` (Procfile). Zmienna `DATABASE_URL` musi być ustawiona w Environment na Render.

Brak testów automatycznych i buildu — weryfikacja przez ręczne odpalenie w przeglądarce.

## Architektura

**Backend** — `app.py` (Flask, ~735 linii). Jeden plik, 6 sekcji:
1. Setup — `get_db()` / `query()` / `execute()` / `register_dictionary_endpoints()`
2. Travels — CRUD podróży
3. Locations — CRUD miejsc z GPS
4. Powiązania — tabele łączące `travel_locations` i `travel_participants`
5. Słowniki — `countries`, `location_types`, `relation_types`, `persons`
6. Statystyki — `/api/stats` (agregaty, hall of fame)

`register_dictionary_endpoints(table, url)` — generuje automatycznie 4 endpointy (GET/POST/PUT/DELETE) dla prostych słowników.

**Frontend** — SPA bez frameworka. `templates/index.html` to tylko shell z nawigacją i tagami `<script>`. Cała logika w `static/js/`:

| Plik | Odpowiedzialność |
|------|-----------------|
| `utils.js` | `api()`, `apiPost()`, `escapeHtml()`, helpery dat i ikon |
| `travels.js` | lista podróży, widok szczegółów podróży |
| `locations.js` | lista miejsc, widok szczegółów miejsca |
| `wizard.js` | multi-step wizard tworzenia nowej podróży |
| `map.js` | mapa Leaflet z MarkerCluster |
| `stats.js` | widok statystyk |
| `timeline.js` | oś czasu podróży |
| `dictionaries.js` | CRUD krajów, typów miejsc, typów relacji |
| `persons.js` | CRUD uczestników |

Nawigacja między zakładkami przez `showTab(name)`. Każda zakładka re-renderuje swój widok przy każdym wejściu.

## Kluczowe wzorce

**Dane w wizardzie** — stan przechowywany wyłącznie w obiekcie `wizardState` (nie na elementach DOM). Przy re-renderze `wizardState.allLocs / countries / locTypes / relTypes` muszą być zachowane.

**Overlaye** — sub-overlaye wizarda (`#wiz-loc-date-overlay`, `#wiz-new-loc-overlay`) są appendowane do `document.body`. `closeWizard()` musi je usuwać ręcznie.

**Baza danych** — PostgreSQL na Neon.tech. `query()` zwraca listę `RealDictRow`, `execute()` zwraca `RETURNING id` lub `None`. Każdy request dostaje nowe połączenie przez `g.db`, zamykane w `teardown_appcontext`.

**Statystyki uczestnictwa** — `person_id=1` to Jarek, `person_id=2` to Hanna — hardkodowane w SQL w `/api/stats`.

## Baza danych — schemat

```
countries, location_types, relation_types   ← słowniki (id, name)
locations      ← miejsca (country_id, location_type_id, parent_location_id?, latitude?, longitude?)
persons        ← uczestnicy (relation_type_id?)
travels        ← podróże (start_date, end_date, amount, currency, rating, ...)
travel_locations    ← M:N travels↔locations (arrival_date, departure_date, notes)
travel_participants ← M:N travels↔persons
```

Lokacje obsługują hierarchię przez `parent_location_id` (np. dzielnica → miasto). Widok miejsca pokazuje zarówno bezpośrednie wizyty jak i wizyty przez lokacje podrzędne (`child_visits`).

## Wdrożenie

Po zmianach w kodzie: `git add` → `git commit` → `git push` — Render automatycznie przebudowuje aplikację z brancha `main`.
