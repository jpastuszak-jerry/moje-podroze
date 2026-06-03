# Current State

Krotki stan projektu dla nowych sesji. Szczegoly historyczne zostaja w
`BACKLOG.md`, a stale zasady pracy w `AGENTS.md`.

## Where We Are

- Projekt: prywatna PWA `Moje Podroze` do zarzadzania podrozami, miejscami,
  uczestnikami, mapa i statystykami.
- Backend: Flask + PostgreSQL Neon, deploy na Render przez `gunicorn app:app`.
- Frontend: vanilla JS SPA bez frameworka, globalne skrypty w `templates/index.html`.
- Aktualny glowny kierunek: stabilizacja testami smoke przed kolejnymi refaktorami.
- Ostatnio domkniete: frontend shell smoke dla kontraktu login/app/PWA assetow.
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
  soft delete/restore, podstawowe helpery UI, kontrakt startowego shella SPA.
- Slabiej pokryte: prawdziwe E2E w przegladarce, realne PostgreSQL fixture,
  importy danych.
- `node` w normalnym PATH jest obecnie problematyczny: alias WindowsApps zwraca
  `Odmowa dostepu`. JS smoke da sie uruchomic przez Node REPL MCP, ale docelowo
  warto zainstalowac zwykly Node LTS w PATH.

## Best Next Topics

1. Pelniejszy browser smoke / E2E dla kluczowych ekranow:
   login/shell, lista podrozy, szczegoly podrozy, Statystyki, Rocznik, Mapa.
2. Realistyczny test integracyjny PostgreSQL na malym fixture:
   podroze, miejsca nadrzedne/podrzedne, uczestnicy, kosz, statystyki.
3. Dopiero potem dalszy refaktor frontendu/statystyk.
4. Alternatywnie: wrocic do importow Revolut/opisow, jesli uzytkownik chce
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
