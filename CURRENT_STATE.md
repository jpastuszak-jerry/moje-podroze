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
- Ostatnio domkniete lokalnie: UX centrum brakow danych miejsc
  `#/locations/todo`. Widok pamieta filtr i sortowanie, obsluguje deep linki z
  query stringiem (`missing`, `sort`), sortuje po priorytecie albo wybranym
  trybie, pokazuje licznik wysokiego priorytetu oraz kolorowe etykiety typow
  brakow na kartach.
- Weryfikacja lokalna tej zmiany: zwykly `node` w PATH nadal zwraca `Odmowa
  dostepu`, wiec `tools/smoke_js.mjs` uruchomiono przez Node REPL MCP; test
  przeszedl. Przeszly tez `python -m py_compile ...`, `python -m ruff check .`,
  `python -m unittest discover -s tests` (57 testow, 7 skipow) oraz
  `git diff --check`.
- Lokalny Flask dla tej zmiany wystartowal i `/healthz` zwrocil 200, ale
  in-app Browser ponownie zablokowal `http://127.0.0.1:5000`
  (`ERR_BLOCKED_BY_CLIENT`), wiec browser E2E lokalnie nadal jest blokerem.
- Ostatnio zweryfikowane: najnowsza seria zmian aplikacyjnych nie dotyczy juz
  importerow, tylko UX i stabilizacji produkcji. `e6862c9` dodal undo po
  miekkim usunieciu, zapamietywanie filtrow/sortowania, pull-to-refresh i
  odtwarzanie scrolla list. `d974a21` naprawil pusta mape po utwardzeniu CSP:
  `connect-src` dopuszcza teraz `https://unpkg.com`, bo service worker pobiera
  Leaflet przez `fetch()`. Pull-to-refresh jest tez wylaczony w widoku mapy,
  zeby nie kolidowal z przesuwaniem mapy.
- Weryfikacja 2026-06-12: GitHub Actions dla ostatnich 5 commitow sa zielone,
  produkcyjny CSP zawiera `connect-src 'self' https://unpkg.com
  https://nominatim.openstreetmap.org`, a `python tools/smoke_prod.py` przeszedl
  11/11 OK dla `https://moje-podroze.onrender.com`. Pierwszy probe `/healthz`
  mial timeout, ale ponowienie zwrocilo `db=ok`, a pelny smoke pozniej przeszedl.
- Ostatnio domkniete i wypchniete na GitHub w commicie `09c1f03 Optimize
  location visit aggregation`: maly performance pass dla `/api/locations` i
  `/api/map-locations`. Stary szeroki join `locations -> child ->
  travel_locations -> travels` z `COUNT(DISTINCT t.id)` i `GROUP BY` po
  kolumnach miejsca zostal zastapiony wspolnym CTE `location_visit_stats`,
  ktory najpierw preagreguje wizyty bezposrednie i wizyty przez bezposrednie
  dzieci miejsc. Kontrakt JSON zostal zachowany (`visit_count`, `last_visit`,
  `first_visit`, `travel_names`).
- Weryfikacja lokalnego performance passu: `python -m unittest discover -s
  tests` przeszedl 46/46, `python -m py_compile ...` dla glownych modulow
  backendu przeszedl, `python -m ruff check .` przeszedl, `git diff --check`
  przeszedl. Dodatkowo test client na prawdziwym `DATABASE_URL` zwrocil
  `/api/locations` 200 z 707 rekordami i `/api/map-locations` 200 z 520
  rekordami, wiec SQL przeszedl na PostgreSQL.
- Po pushu `09c1f03` GitHub Actions przeszly na zielono, a produkcyjny smoke
  `python tools/smoke_prod.py` przeszedl 11/11 OK dla
  `https://moje-podroze.onrender.com`.
- Ostatnio domkniete i wypchniete na GitHub w commicie `ef39e44 Expose build
  info in production smoke`: `/healthz` zwraca teraz publiczny blok `build`
  z wersja aplikacji i SHA commita wykrytym ze zmiennych Render/GitHub albo
  lokalnego `.git`. `tools/smoke_prod.py` sprawdza teraz zgodnosc
  produkcyjnego `build.source_revision` z lokalnym HEAD oraz naglowki
  bezpieczenstwa/CSP, w tym `connect-src` z `https://unpkg.com` dla mapy.
- Weryfikacja po deployu `ef39e44`: GitHub Actions przeszly na zielono, a nowy
  `python tools/smoke_prod.py` przeszedl 12/12 OK i potwierdzil produkcyjny
  build `ef39e44`.
- Ostatnio domkniete i wypchniete na GitHub w commicie `9ce436d Add
  PostgreSQL integration smoke`: dodano opcjonalny test integracyjny PostgreSQL
  na tymczasowym schemacie `TEST_DATABASE_URL`. Fixture sprawdza podroze,
  miejsca nadrzedne/podrzedne, uczestnika, kosz, statystyki i realne zapytania
  `/api/locations`, `/api/map-locations`, `/api/locations/<id>`,
  `/api/stats?year=2025` oraz `/api/trash`. Przy okazji naprawiono agregacje
  mapy miejsc: `first_visit` liczy teraz start wizyty, a `last_visit` koniec
  wizyty, zamiast uzywac jednej daty preferujacej wyjazd.
- Weryfikacja po `9ce436d`: lokalnie przeszly `py_compile` glownych modulow i
  nowego testu, `python -m ruff check .`, `python -m unittest discover -s
  tests` 54/54 OK z 4 skipami bez `TEST_DATABASE_URL`, realny
  `TEST_DATABASE_URL` test integracyjny 4/4 OK, `git diff --check`, GitHub
  Actions zielone oraz produkcyjny `python tools/smoke_prod.py` 12/12 OK dla
  buildu `9ce436d` na Renderze.
- Ostatnio domkniete: rozszerzono realny PostgreSQL fixture o zapisy bez
  asysty uzytkownika. Test integracyjny sprawdza teraz takze tworzenie podrozy
  przez `/api/travels/wizard` wraz z miejscami i uczestnikiem oraz edycje
  podrozy: konflikt dat wizyt przy zwezaniu zakresu i skuteczne `on_conflict:
  clip`, ktore przycina daty w `travel_locations`.
- Weryfikacja rozszerzonego fixture: `python -m py_compile ...` dla glownych
  modulow i testu przeszedl, `python -m ruff check .` przeszedl,
  `python -m unittest discover -s tests` przeszedl 56/56 OK z 6 skipami bez
  `TEST_DATABASE_URL`, realny `TEST_DATABASE_URL` test integracyjny przeszedl
  6/6 OK, a `git diff --check` przeszedl.
- Ostatnio domkniete: rozszerzono realny PostgreSQL fixture o CRUD miejsc bez
  asysty uzytkownika. Test tworzy miejsce przez `/api/locations`, sprawdza
  blokade duplikatu, odczyt szczegolu, edycje danych i parenta, soft delete,
  obecnosc w `/api/trash`, restore oraz hard delete miejsca bez wizyt.
- Weryfikacja CRUD miejsc w fixture: `python -m py_compile ...` dla glownych
  modulow i testu przeszedl, `python -m ruff check .` przeszedl,
  `python -m unittest discover -s tests` przeszedl 57/57 OK z 7 skipami bez
  `TEST_DATABASE_URL`, realny `TEST_DATABASE_URL` test integracyjny przeszedl
  7/7 OK, a `git diff --check` przeszedl.
- Ostatnio domkniete: zweryfikowano 56 historycznych rezerwacji Booking.com
  wzgledem bazy Neon. Przed zmianami 4 noclegi byly juz potwierdzone jako
  miejsca podrozy z datami. Dopisano 50 nowych miejsc, 23 wizyty z datami do
  pasujacych wycieczek i uzupelniono notatki istniejacego `Hotel IOR` dla 2
  starszych pobytow bez pasujacej wycieczki. Po kontroli 27 rezerwacji ma
  miejsce i wizyte w `travel_locations`, a 29 zostaje jako samo miejsce z
  notatka `UWAGA: Booking.com...` do pozniejszego powiazania. Backup i raport:
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_booking\booking_reconcile_backup_20260606_122132.json`
  oraz
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_booking\booking_reconcile_applied_20260606_122135.json`.
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
- GitHub Actions dla najnowszego pushu na `main` byly zielone.
- Produkcyjny smoke po najnowszym deployu przeszedl: `python tools/smoke_prod.py`,
  12/12 OK.

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
  oraz smoke renderowania kluczowych ekranow UI, w tym deep linki hash-routera
  i parametry centrum brakow miejsc. Produkcyjny smoke sprawdza tez build SHA
  i CSP wymagany przez mape. Jest tez opcjonalny realny
  PostgreSQL fixture na tymczasowym schemacie, obejmujacy odczyty, kosz,
  statystyki, kreator zapisu, edycje zakresu dat podrozy oraz CRUD miejsc.
- Slabiej pokryte: prawdziwe E2E w przegladarce, importy danych i mniej typowe
  warianty zapisu/edycji w realnym PostgreSQL fixture.
- `node` w normalnym PATH jest obecnie problematyczny: alias WindowsApps zwraca
  `Odmowa dostepu`. JS smoke da sie uruchomic przez Node REPL MCP, ale docelowo
  warto zainstalowac zwykly Node LTS w PATH.

## Best Next Topics

1. Dalszy UX centrum brakow miejsc: szybkie akcje z kart albo lekki widok
   grupowania po kraju/typie braku, zeby przechodzic od raportu do uzupelniania
   danych bez wracania przez liste miejsc.
2. Ponowne uzupelnianie `address`/`notes` miejsc, ale tylko opisami
   konkretnymi dla danego miejsca. Pracowac malymi partiami, najpierw pokazac
   probki uzytkownikowi. Aktualnie 475 aktywnych miejsc ma brakujacy
   `address` albo `notes`.
3. Reczna weryfikacja 142 pozostalych miejsc bez GPS z raportu
   `db_geocode_remaining_20260603_135807.csv`, zwlaszcza pozycji
   `ambiguous` i `manual_review_excluded`.
4. Prawdziwe browser E2E po naprawie Node/Playwright:
   login, interakcje na liscie podrozy, undo po miekkim usunieciu, odtwarzanie
   scrolla, pull-to-refresh, szczegoly podrozy, Statystyki, Rocznik, Mapa.
5. Rozszerzyc realny PostgreSQL fixture o kolejne rzadziej uzywane flow, np.
   slowniki, osoby albo przypadki FK typu hard delete miejsca uzywanego w
   `travel_locations`, gdy kolejne prace dotkna tych endpointow.
6. Po refaktorze SPA: ewentualnie rozszerzyc deep linki o stan sekcji
   statystyk/filtry, jesli bedzie to przydatne w UX i testach.
7. Alternatywnie: wrocic do importow Revolut/opisow, jesli uzytkownik chce
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
