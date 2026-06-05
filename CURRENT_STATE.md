# Current State

Krotki stan projektu dla nowych sesji. Szczegoly historyczne zostaja w
`BACKLOG.md`, a stale zasady pracy w `AGENTS.md`.

## Where We Are

- Projekt: prywatna PWA `Moje Podroze` do zarzadzania podrozami, miejscami,
  uczestnikami, mapa i statystykami.
- Backend: Flask + PostgreSQL Neon, deploy na Render przez `gunicorn app:app`.
- Frontend: vanilla JS SPA bez frameworka, globalne skrypty w `templates/index.html`.
- Aktualny glowny kierunek: jakosc danych miejsc, zwlaszcza konkretne
  `address`/`notes` oraz pozostale braki GPS, przy zachowaniu stabilizacji smoke
  przed wiekszymi refaktorami.
- Ostatnio domkniete: dodano `ARCHITECTURE_BLUEPRINT.md`, czyli przekrojowy
  opis aktualnej architektury aplikacji: frontend SPA/PWA, backend Flask,
  Neon PostgreSQL, Render deploy, CI, smoke testy, model danych, glowne flow i
  obecne ograniczenia. Dokument ma sluzyc jako mapa dla uzytkownika i kolejnych
  agentow.
- Ostatnio domkniete: maly refaktor wspolnego helpera odmiany liczebnikow w
  frontendzie. Dodano `polishPlural()` w `static/js/utils.js` i podpieto go w
  licznikach podrozy, wynikow, wizyt, lat oraz list "Do uzupelnienia" w
  `stats.js`, `locations.js` i `travels.js`. Korzysc: jedna regule odmiany
  `1 / 2-4 / reszta` utrzymuje sie w jednym miejscu zamiast powielac ja w
  kilku widokach. Weryfikacja: skladnia zmienionych JS przez Node REPL MCP,
  `tools/smoke_js.mjs` przez Node REPL MCP oraz `git diff --check` przeszly.
  Zwykly `node` w PATH nadal zwraca `Odmowa dostepu`.
- Ostatnio domkniete: refaktor SPA do hash-routera. `startRouter()` zastapil
  startowe `renderTravels()`, a `showTab()`, `openTravel()` i `openLocation()`
  przechodza przez trasy typu `#/travels`, `#/travels/:id`, `#/locations/:id`,
  `#/stats/todo` i `#/locations/todo`. Zaktualizowano tez shell smoke test,
  zeby oczekiwal startu routera.
- Weryfikacja po refaktorze SPA: skladnia zmienionych JS sprawdzona przez Node
  REPL MCP, `tools/smoke_js.mjs` przeszedl przez Node REPL MCP, a
  `python -m unittest discover -s tests` przeszedl lokalnie po aktualizacji testu
  shella. Zwykly `node` w PATH nadal zwraca `Odmowa dostepu`. Lokalny Flask
  wystartowal i `/healthz` zwrocil `db=ok`, ale in-app Browser zablokowal
  `localhost`/`127.0.0.1` (`ERR_BLOCKED_BY_CLIENT`), wiec nie wykonano browser
  E2E.
- Ostatnio domkniete: uzupelniono kolejna losowa partie 30 konkretnych
  `address`/`notes` zgodnie z zaakceptowanym wzorcem: opis miejsca w
  `address`, a w `notes` krotkie `Typ:`/`Region:`. Dla wazniejszych miejsc
  opisy sa dwuakapitowe, istniejace notatki zostaly zachowane z dopiskiem na
  koncu, a GPS nie byl ruszany. Po tej partii 480 aktywnych miejsc ma brakujacy
  `address` albo `notes`. Raport i backup:
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_notes\notes_address_30_applied_20260605_133850.json`
  i
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_notes\notes_address_30_backup_20260605_133850.json`.
- Poprzednio domkniete: po wycofaniu blednej masowej partii uzupelniono mala,
  zaakceptowana probke `address`/`notes` dla 20 konkretnych miejsc. Dla
  wazniejszych miejsc przyjeto opis dwuakapitowy, a istniejace notatki zostaly
  zachowane z dopiskiem `Typ:`/`Region:` na koncu. GPS nie byl ruszany.
  Raport i backup:
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_notes\notes_address_20_applied_20260604_125334.json`
  i
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_notes\notes_address_20_backup_20260604_125334.json`.
  Po tej probce 510 aktywnych miejsc ma brakujacy `address` albo `notes`.
- Poprzednio domkniete: wycofano bledna partie automatycznych uzupelnien
  `address`/`notes` dla 442 miejsc, poniewaz opisy byly zbyt generyczne i
  nie opisywaly konkretnych miejsc. Przywrocono wartosci z backupu:
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_notes\notes_address_backup_20260604_121124.json`.
  Raport wycofania:
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_notes\notes_address_revert_20260604_124115.json`.
  Po wycofaniu bylo 530 aktywnych miejsc z brakujacym `address` albo `notes`.
  Wniosek operacyjny: nie robic masowych generycznych opisow; kolejne podejscie
  musi byc konkretne dla miejsca, male partiami, z akceptacja probek.
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

1. Ponowne uzupelnianie `address`/`notes` miejsc, ale tylko opisami
   konkretnymi dla danego miejsca. Pracowac malymi partiami, najpierw pokazac
   probki uzytkownikowi. Aktualnie 480 aktywnych miejsc ma brakujacy
   `address` albo `notes`.
2. Reczna weryfikacja 142 pozostalych miejsc bez GPS z raportu
   `db_geocode_remaining_20260603_135807.csv`, zwlaszcza pozycji
   `ambiguous` i `manual_review_excluded`.
3. Prawdziwe browser E2E po naprawie Node/Playwright:
   login, interakcje na liscie podrozy, szczegoly podrozy, Statystyki, Rocznik, Mapa.
4. Realistyczny test integracyjny PostgreSQL na malym fixture:
   podroze, miejsca nadrzedne/podrzedne, uczestnicy, kosz, statystyki.
5. Po refaktorze SPA: ewentualnie rozszerzyc deep linki o stan sekcji
   statystyk/filtry, jesli bedzie to przydatne w UX i testach.
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
