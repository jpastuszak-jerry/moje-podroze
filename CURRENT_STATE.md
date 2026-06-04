# Current State

Krotki stan projektu dla nowych sesji. Szczegoly historyczne zostaja w
`BACKLOG.md`, a stale zasady pracy w `AGENTS.md`.

## Where We Are

- Projekt: prywatna PWA `Moje Podroze` do zarzadzania podrozami, miejscami,
  uczestnikami, mapa i statystykami.
- Backend: Flask + PostgreSQL Neon, deploy na Render przez `gunicorn app:app`.
- Frontend: vanilla JS SPA bez frameworka, globalne skrypty w `templates/index.html`.
- Aktualny glowny kierunek: jakosc danych miejsc, zwlaszcza brakujace GPS,
  przy zachowaniu stabilizacji smoke przed wiekszymi refaktorami.
- Ostatnio domkniete: uzupelniono `address`/`notes` dla 442 aktywnych miejsc
  w bazie Neon, bez ruszania GPS. Istniejace notatki z importow, np. Revolut,
  zostaly zachowane, a dopiski `Typ:`/`Region:` dodane na koncu.
  Przed praca bylo 530 aktywnych miejsc z brakujacym `address` albo `notes`,
  po pracy zostalo 88. Szczegoly sa w lokalnych raportach:
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_notes\notes_address_applied_20260604_121124.json`
  i
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_notes\notes_address_skipped_20260604_121124.csv`.
- Poprzednio domkniete: uzupelniono GPS dla 151 aktywnych miejsc w bazie Neon.
  Przed praca bylo 293 aktywnych miejsc bez GPS, po pracy zostalo 142.
  Szczegoly sa w lokalnych raportach:
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_geocode\db_geocode_applied_20260603_135807.json`
  i
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_geocode\db_geocode_remaining_20260603_135807.csv`.
- GitHub Actions dla ostatniego commita byly zielone.
- Produkcyjny smoke po deployu przeszedl: `python tools/smoke_prod.py`, 11/11 OK.

## Maintenance Rule

- Po zakonczonej pracy, commicie, pushu, deployu albo zmianie priorytetow agent
  ma przed finalna odpowiedzia sprawdzic, czy ten plik wymaga aktualizacji.
- Aktualizowac tylko stan operacyjny: ostatnia praca, CI/deploy/smoke,
  istotny dirty state, kolejne tematy i znane blokery.
- Nie dopisywac dlugiej historii. Szczegoly i roadmapa zostaja w `BACKLOG.md`.

## Current Dirty State

- W repo sa lokalne, niecommitowane pliki importowe:
  - `tools/import_travel_descriptions.py`
  - `tools/import_revolut_places.py`
- Nie ruszac ich przy niezaleznych pracach, chyba ze uzytkownik wprost wraca do importow.

## Smoke Coverage

- Funkcjonalne pokrycie smoke'ami glownego produktu: ok. 70%.
- Dobrze pokryte: auth, prywatne API, shell, PWA smoke produkcji, podstawowe
  read/write API, kreator transakcyjny, statystyki, rocznik, mapa, kosz,
  soft delete/restore, podstawowe helpery UI, kontrakt startowego shella SPA
  oraz smoke renderowania kluczowych ekranow UI.
- Slabiej pokryte: prawdziwe E2E w przegladarce, realne PostgreSQL fixture,
  importy danych.
- `node` w normalnym PATH jest obecnie problematyczny: alias WindowsApps zwraca
  `Odmowa dostepu`. JS smoke da sie uruchomic przez Node REPL MCP, ale docelowo
  warto zainstalowac zwykly Node LTS w PATH.

## Best Next Topics

1. Reczna weryfikacja 88 pozostalych miejsc z brakujacym `address`/`notes`
   z raportu `notes_address_skipped_20260604_121124.csv`, glownie pozycje
   komercyjne z niepewnymi merchant notes albo kontekstem.
2. Reczna weryfikacja 142 pozostalych miejsc bez GPS z raportu
   `db_geocode_remaining_20260603_135807.csv`, zwlaszcza pozycji
   `ambiguous` i `manual_review_excluded`.
3. Prawdziwe browser E2E po naprawie Node/Playwright:
   login, interakcje na liscie podrozy, szczegoly podrozy, Statystyki, Rocznik, Mapa.
4. Realistyczny test integracyjny PostgreSQL na malym fixture:
   podroze, miejsca nadrzedne/podrzedne, uczestnicy, kosz, statystyki.
5. Dopiero potem dalszy refaktor frontendu/statystyk.
6. Alternatywnie: wrocic do importow Revolut/opisow, jesli uzytkownik chce
   domknac lokalne pliki importowe.

## Important Product Decisions

- Daty i czas trwania liczone inkluzywnie: ten sam dzien to 1 dzien.
- Oceny podrozy: 0.5-5.0 co 0.5, render przez `stars()` w `static/js/utils.js`.
- Usuwanie podrozy i miejsc jest miekkie (`deleted_at`), restore przez endpointy.
- Kreator zapisuje podroz atomowo przez `POST /api/travels/wizard`.
- Statystyki uczestnikow nie moga zakladac hardkodowanych `person_id`.
- Endpointy prywatne wymagaja admin session; koszty i statystyki sa `no-store`.

## Verification Shortlist

Przy zmianach backend/test:

```powershell
python -m py_compile app.py core.py travels.py locations.py dicts.py stats.py schemas.py migrate.py schema_migrations.py
python -m py_compile stats_common.py stats_countries.py stats_quality.py stats_hall_of_fame.py stats_yearbook.py
python -m ruff check .
python -m unittest discover -s tests
git diff --check
```

Przy zmianach JS:

```powershell
node tools/smoke_js.mjs
```

Jesli `node` nadal zwraca `Odmowa dostepu`, sprawdzic smoke przez Node REPL MCP
albo naprawic Node LTS w PATH.

Po deployu:

```powershell
python tools/smoke_prod.py
```
