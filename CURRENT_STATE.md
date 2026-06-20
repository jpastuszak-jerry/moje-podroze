# Current State

Krotki stan projektu dla nowych sesji. Szczegoly historyczne zostaja w
`BACKLOG.md`, a stale zasady pracy w `AGENTS.md`.

## Where We Are

- Projekt: prywatna PWA `Moje Podroze` do zarzadzania podrozami, miejscami,
  uczestnikami, mapa i statystykami.
- Backend: Flask + PostgreSQL Neon, deploy na Render przez `gunicorn app:app`.
- Frontend: vanilla JS SPA bez frameworka, globalne skrypty w `templates/index.html`.
- Aktualny glowny kierunek: po domknieciu efektownego Rocznika 2.0 najlepsze
  kolejne prace to male domkniecia UX/statystyk albo dalsze centrum brakow
  miejsc, bez otwierania duzego nowego obszaru.
- Ostatnio domkniete i wypchniete na GitHub w commicie `6c9dad1 Harden cache
  and async view state`: pakiet stabilizacyjny po optymalizacji duzych widokow.
  Frontend wersjonuje cache, wiec odpowiedz rozpoczeta przed zapisem nie moze
  po zapisie ponownie zapamietac starych danych. Spoznione odpowiedzi listy
  podrozy, miejsc, mapy, statystyk, list brakow i szczegolow sa ignorowane po
  zmianie ekranu albo rozpoczeciu nowszego renderu. Udane POST/PUT/DELETE
  czyszcza cache, a bledne mutacje go zachowuja. `Procfile` jawnie wymusza
  jeden worker Gunicorna, zgodnie z procesowym cache backendu. Realny
  PostgreSQL fixture potwierdzil zmiane ETag i odswiezenie `/api/locations`
  po dodaniu, edycji, soft delete i restore. Browser smoke wykonal szybkie
  sekwencje `Miejsca -> Mapa -> Podroze` oraz
  `Mapa -> Statystyki -> Miejsca` na desktopie i 390x844 bez bledow konsoli,
  nadpisania widoku ani overflow. Lokalnie przeszly kompilacja Pythona, Ruff,
  74 testy (9 skipow), smoke JS, `git diff --check` i realny PostgreSQL 9/9.
  Kontrolny pomiar zachowal cieple czasy ok. 4-10 ms. GitHub Actions byly
  zielone, a produkcyjny `python tools/smoke_prod.py` przeszedl 12/12 OK i
  potwierdzil build `6c9dad1`.
- Ostatnio domkniete i wypchniete na GitHub w commicie `d771c2a Speed up
  large data views`: pakiet wydajnosciowy oparty na pomiarach rzeczywistej
  bazy. `/api/locations`, `/api/locations/todo` i `/api/map-locations` maja
  teraz krotki cache procesu uniewazniany wersja zapisow DB, a `etag_json()`
  serializuje odpowiedz tylko raz. Powtorne czasy test clienta spadly
  medianowo z ok. 138-161 ms do 5-14 ms, czyli 10-26 razy. Frontend
  wspoldzieli zaladowane miejsca, podroze, liste brakow i dane mapy, usuwa
  cache po zapisie albo pull-to-refresh, wyszukuje miejsca lokalnie oraz
  wykorzystuje ponownie markery Leafleta. Lista 711 miejsc renderuje sie
  partiami po 60 kart, pomija koszt ukladu poza ekranem i animuje tylko
  pierwsza partie. Browser smoke na prawdziwej bazie potwierdzil 711 kart,
  29 krajow, lokalne wyszukiwanie `Helsinki` do 3 wynikow, 504 karty brakow,
  530 miejsc mapy oraz brak poziomego overflow na 390x844. Lokalnie przeszly
  kompilacja Pythona, Ruff, 72 testy (9 skipow), smoke JS i
  `git diff --check`. GitHub Actions byly zielone, a produkcyjny
  `python tools/smoke_prod.py` przeszedl 12/12 OK i potwierdzil build
  `d771c2a`. Render potwierdzil kompresje Brotli, wiec nie dodawano osobnej
  biblioteki kompresujacej.
- Ostatnio domkniete i wypchniete na GitHub w commitach `f09a511 Show travel
  routes on the map` i korekcie `1efe328 Remove misleading travel route
  lines`: przycisk w sekcji "Trasa i miejsca" otwiera teraz mape podrozy z
  numerowanymi markerami zgodnymi z kolejnoscia wizyt, popupami z numerem i
  data oraz panelem nazwy, zakresu dat i liczby etapow. Proste linie miedzy
  markerami zostaly usuniete, poniewaz mogly sugerowac nieprawdziwy przebieg
  przejazdu. Miejsca bez GPS sa pomijane na mapie i liczone w panelu;
  "Wszystkie miejsca" przywraca zwykle markery i klastry.
  Browser smoke na prawdziwej podrozy Tirana/Kosowo potwierdzil 25 markerow,
  poprawny popup etapu 25, brak overflow na 390x844 oraz bezbledny
  powrot do 528 miejsc. Lokalnie przeszly Ruff, 60 testow (7 skipow), smoke
  JS i `git diff --check`. GitHub Actions byly zielone, a produkcyjny
  `python tools/smoke_prod.py` przeszedl 12/12 OK i potwierdzil build
  `1efe328`.
- Ostatnio domkniete i wypchniete na GitHub w commicie `9e2c1db Add manual
  ordering for travel stops`: miejsca z ta sama data wizyty mozna teraz
  porzadkowac strzalkami gora/dol w trybie `Kolejnosc` sekcji "Trasa i
  miejsca". Kolejnosc jest trwale zapisywana w `travel_locations.visit_order`
  przez wersjonowana migracje, obowiazuje jednoczesnie na liscie i numerowanych
  markerach mapy, a nowe miejsce lub wpis przeniesiony na inny dzien trafia na
  koniec tego dnia. Soft-deleted miejsca nie blokuja porzadkowania widocznych
  wpisow. Lokalnie przeszly kompilacja Pythona, Ruff, 67 testow (8 skipow),
  smoke JS i `git diff --check`. GitHub Actions byly zielone, a produkcyjny
  `python tools/smoke_prod.py` przeszedl 12/12 OK i potwierdzil build
  `9e2c1db`. In-app Browser nadal nie widzi lokalnego `127.0.0.1`, wiec po
  deployu pozostaje krotki reczny smoke na telefonie.
- Ostatnio domkniete i wypchniete na GitHub w commicie `85bbe7c Filter travel
  map by day`: numerowana mapa podrozy ma teraz poziomo przewijany filtr
  `Wszystkie` oraz dni, w ktorych zapisano miejsca, np. `Dzien 1`, `Dzien 2`,
  `Dzien 5`. Wybranie dnia pokazuje tylko jego markery i dopasowuje widok
  mapy, ale zachowuje globalne numery etapow calej podrozy. Miejsca sa
  przypisywane do dnia wedlug `arrival_date`; osobno obslugiwane sa wpisy bez
  daty. Lokalnie przeszly Ruff, 67 testow (8 skipow), smoke JS i
  `git diff --check`. Smoke JS sprawdza filtrowanie dnia, globalny numer
  markera i powrot do wszystkich dni. GitHub Actions byly zielone, a
  produkcyjny `python tools/smoke_prod.py` przeszedl 12/12 OK i potwierdzil
  build `85bbe7c`. In-app Browser otworzyl produkcyjny login na 390x844, ale
  swieza sesja nie byla uwierzytelniona, wiec interakcyjnego smoke prywatnej
  mapy nie wykonywano.
- Ostatnio domkniete i wypchniete na GitHub w commicie `5405553 Harden
  validation migrations and route state`: pakiet stabilizacyjny po mapie
  tras. Wspolna odpowiedz walidacji Pydantic usuwa nieserializowalny kontekst
  `ValueError`, dzieki czemu bledna ocena, pusta nazwa miejsca lub osoby
  zwracaja teraz JSON HTTP 400 zamiast awarii 500. Migracje startowe sa
  serializowane transakcyjna blokada advisory PostgreSQL, wiec rownolegle
  startujace workery Gunicorna nie wykonuja tej samej migracji jednoczesnie.
  Mapa korzysta ze wspolnej obslugi bledow API i poprawnego helpera `toast`.
  Smoke JS sprawdza tez spojnosc payloadu mapy po zmianie dnia i usunieciu
  miejsca z trasy oraz awaryjna sciezke blednego payloadu mapy. Lokalnie
  przeszly kompilacja Pythona, Ruff, 70 testow (9 skipow), smoke JS i
  `git diff --check`; realny PostgreSQL fixture przeszedl 9/9, w tym ochrone
  FK dla slownikow, osoby i miejsca uzywanego w podrozy. GitHub Actions byly
  zielone, a produkcyjny `python tools/smoke_prod.py` przeszedl 12/12 OK i
  potwierdzil build `5405553`.
- Ostatnio domkniete i wypchniete na GitHub w commicie `def76ae Compact
  location descriptions on mobile`: dlugie opisy na kartach listy miejsc sa
  ograniczone do 2 linii, a w profilu miejsca do 3 linii z natywnym
  `Pokaz wiecej`/`Zwin opis`; krotkie opisy pozostaja w pelni widoczne.
  Dymki mapy maja skrocony opis i liste podrozy, limit wysokosci, przewijanie
  oraz `keepInView`, dzieki czemu nie wypadaja poza ekran iPhone'a. Browser
  smoke na viewportcie 390x844 potwierdzil brak poziomego overflow, poprawne
  rozwijanie oraz popup 177 px mieszczacy sie w obszarze mapy. Lokalnie
  przeszly Ruff, 60 testow (7 skipow), smoke JS i `git diff --check`.
  GitHub Actions byly zielone, a produkcyjny `python tools/smoke_prod.py`
  przeszedl 12/12 OK i potwierdzil build `def76ae`.
- Ostatnio domkniete i wypchniete na GitHub w commicie `c30d196 Add cost
  timeline and stats deep links`: sekcja Koszty pokazuje teraz koszty wedlug
  lat dla widoku "Wszystkie" oraz wedlug miesiecy dla wybranego roku, z
  najdrozszym okresem i porownaniem rok do roku. Statystyki zachowuja sekcje i
  rok w URL, np. `#/stats?section=costs&year=2025`, takze po odswiezeniu.
  Lokalnie przeszly kompilacja Pythona, Ruff, 60 testow (7 skipow), smoke JS
  i `git diff --check`. Browser smoke potwierdzil desktop, mobile, deep link i
  odswiezenie bez bledow konsoli. GitHub Actions byly zielone, a produkcyjny
  `python tools/smoke_prod.py` przeszedl 12/12 OK i potwierdzil build
  `c30d196`.
- Ostatnio domkniete w bazie Neon 2026-06-17: kolejna ostrozna partia jakosci
  danych miejsc. Z losowej puli niepelnych miejsc wybrano 40 jednoznacznych
  rekordow i uzupelniono tylko pewne pola: 35 opisow w `address`, 39 notatek
  `Typ:`/`Region:` oraz 3 brakujace GPS. Istniejace opisy/notatki zostaly
  zachowane; przy braku precyzyjnego GPS dla portu Mazara del Vallo
  wspolrzedne zostaly pominiete. Po zmianie aktywne miejsca: 339 z adresem,
  430 z notatkami, 528 z GPS, 484 nadal z co najmniej jednym brakiem.
  Backup i finalny raport:
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_data_quality\locations_fill_backup_20260617_182151.json`
  oraz
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_data_quality\locations_fill_final_report_20260617_182541.json`.
  Weryfikacja procesu: `git diff --check -- CURRENT_STATE.md` przeszedl,
  dokumentacyjny commit zostal wypchniety, GitHub Actions byly zielone, a
  produkcyjny `python tools/smoke_prod.py` przeszedl 12/12 OK.
- Ostatnio domkniete w bazie Neon 2026-06-17 po uwadze o zbyt ubogich opisach:
  rozszerzono pierwsza zaakceptowana partie 12 miejsc do bogatszego,
  dwuakapitowego wzorca w `address` (ok. 490-565 znakow na opis). Dotyczylo:
  Porto, Przelecz Jugowska, Santiago de Compostela, Lago di Piana degli
  Albanesi, Plac Tiananmen, Avola, Nalaguraidhoo, San Bartolome de
  Tirajana, Glossa, Plac sw. Piotra, Palermo i Sukothai. `notes`, GPS i nazwy
  miejsc nie byly ruszane. Backup i raport:
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_data_quality\rich_descriptions_batch1_backup_20260617_184150.json`
  oraz
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_data_quality\rich_descriptions_batch1_applied_20260617_184150.json`.
  Weryfikacja procesu: commit `a02bf1e` zostal wypchniety, GitHub Actions byly
  zielone, a produkcyjny `python tools/smoke_prod.py` przeszedl 12/12 OK i
  potwierdzil build `a02bf1e`.
- Ostatnio domkniete w bazie Neon 2026-06-17: druga zaakceptowana partia
  bogatszych opisow miejsc. Rozszerzono `address` dla 8 rekordow: Klima,
  Kosciol sw. Wenery w Avoli, Porto di Mazara del Vallo, Cattedrale di San
  Demetrio Megalomartire, Maribor, Wat Mahathat, Levanzo i Castellina in
  Chianti. Zakres opisow po zmianie: ok. 467-540 znakow, `notes`, GPS i nazwy
  miejsc nie byly ruszane. Backup i raport:
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_data_quality\rich_descriptions_batch2_backup_20260617_185017.json`
  oraz
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_data_quality\rich_descriptions_batch2_applied_20260617_185017.json`.
  Weryfikacja procesu: commit `9bb56d1` zostal wypchniety, GitHub Actions byly
  zielone, a produkcyjny `python tools/smoke_prod.py` przeszedl 12/12 OK i
  potwierdzil build `9bb56d1`.
- Ostatnio domkniete w bazie Neon 2026-06-17: finalna zatwierdzona partia
  poprawianej kolekcji opisow miejsc. Rozszerzono `address` dla 17 rekordow:
  Chiesa del Collegio dei Gesuiti, Colosseum, Berliner Dom, Red Beach,
  Kreuzberg, Palazzo dei Normanni, Cala Minnola, Maglev, Sferro, Baixa, Gory
  Sowie, Oia, Wignacourt Museum, Museo Carmen Thyssen Malaga, Kasbah di Mazara
  del Vallo, Orebic i Broumov. Zakres opisow po zmianie: 486-591 znakow; zapis
  kontrolny potwierdzil 17/17 rekordow i brak problemow kodowania. `notes`, GPS
  i nazwy miejsc nie byly ruszane. Backup i raport:
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_data_quality\rich_descriptions_final_backup_20260617_190216.json`
  oraz
  `C:\Users\admin\AppData\Local\Temp\moje_podroze_data_quality\rich_descriptions_final_applied_20260617_190216.json`.
  Weryfikacja procesu: commit `dffaf5a` zostal wypchniety, GitHub Actions byly
  zielone, pierwszy produkcyjny smoke trafil chwilowe `503` na `/healthz`
  podczas deployu, a ponowiony `python tools/smoke_prod.py` przeszedl 12/12 OK
  i potwierdzil build `dffaf5a`.
- Ostatnio domkniete i wypchniete na GitHub w commicie `22ba2d0 Refresh
  backlog priorities`: porzadkowy audyt `BACKLOG.md`. Dodano na gorze aktualny
  indeks backlogu z podzialem wg potencjalnej korzysci, wskazano aktywne
  tematy, parking i korekty statusow. Zaktualizowano m.in. status sekcyjnych
  endpointow statystyk, realnego PostgreSQL fixture, centrum brakow miejsc,
  faz UI cleanupu, wydajnosci miejsc oraz Rocznika. GitHub Actions dla
  `22ba2d0` byly zielone, a produkcyjny `python tools/smoke_prod.py` przeszedl
  12/12 OK i potwierdzil build `22ba2d0`.
- Ostatnio domkniete i wypchniete na GitHub w commicie `17bd7c1 Cache map
  markers for faster filtering`: kolejny maly performance pass frontendu.
  Mapa buduje teraz markery Leafleta raz po pobraniu `/api/map-locations`, a
  filtrowanie typu/kraju przepina cache'owane markery w klastrze zamiast
  tworzyc je od nowa. Selecty mapy sortuja wartosci wspolnym polskim
  `Intl.Collator`, pickery miejsc w kreatorze i w dodawaniu miejsca licza
  tekst zapytania tylko raz na zmiane, a lata na liscie podrozy sortuja sie
  numerycznie.
- Weryfikacja tej zmiany: lokalnie `tools/smoke_js.mjs` przeszedl przez Node
  REPL MCP, `git diff --check` przeszedl, smoke JS sprawdza cache markerow
  mapy i normalizacje wyszukiwania pickerow. GitHub Actions dla `17bd7c1`
  byly zielone, a produkcyjny `python tools/smoke_prod.py` przeszedl 12/12 OK
  i potwierdzil build `17bd7c1`.
- Ostatnio domkniete i wypchniete na GitHub w commicie `45f26d7 Split stats
  sections and group location worklist`: pakiet `wydajnosc statystyk + UX
  brakow miejsc`. Backend dodal sekcyjne endpointy
  `/api/stats/section/<section>` dla zakladek `yearbook`, `countries`,
  `costs`, `participants` i `quality`, a `static/js/stats.js` przestal
  pobierac pelny `/api/stats` przy przelaczaniu tych sekcji. Pelny
  `/api/stats` zostaje jako kompatybilny kontrakt. Widok `#/locations/todo` ma
  teraz zapamietywane i deep-linkowane grupowanie kart po kraju albo typie
  braku, obok dotychczasowego filtra i sortowania.
- Weryfikacja lokalna tego pakietu: `python -m py_compile ...` dla glownych
  modulow przeszedl, `python -m ruff check .` przeszedl,
  `python -m unittest discover -s tests` przeszedl (59 testow, 7 skipow),
  `tools/smoke_js.mjs` przeszedl przez Node REPL MCP, a `git diff --check`
  przeszedl z samymi ostrzezeniami CRLF. Zwykly `node` w PATH w tej sesji byl
  niedostepny (`CommandNotFoundException`), wiec JS nadal sprawdzac przez Node
  REPL MCP albo po naprawie Node LTS w PATH. GitHub Actions dla `45f26d7` byly
  zielone, a produkcyjny `python tools/smoke_prod.py` przeszedl 12/12 OK po
  deployu i potwierdzil build `efccbea`.
- Ostatnio domkniete i wypchniete na GitHub w commicie `fc66b78 Speed up
  location list sorting`: maly performance pass dla glownej listy miejsc.
  Sortowanie po kraju/nazwie oraz opcje filtrow kraju/typu uzywaja teraz
  wspolnego `Intl.Collator('pl')` zamiast tworzyc kosztowne porownania
  `localeCompare(..., { sensitivity: 'base' })` w kazdym porownaniu. Sortowanie
  po ostatniej wizycie porownuje daty ISO bez lokalizacji, a centrum brakow
  miejsc wspoldzieli ten sam komparator tekstowy.
- Weryfikacja tej zmiany: `tools/smoke_js.mjs` przeszedl przez Node REPL MCP,
  `git diff --check` przeszedl, syntetyczny benchmark 1200 miejsc spadl
  medianowo z ok. 362 ms do ok. 21 ms, GitHub Actions dla `fc66b78` byly
  zielone, a produkcyjny `python tools/smoke_prod.py` przeszedl 12/12 OK i
  potwierdzil build `fc66b78`.
- Ostatnio domkniete lokalnie: maly cleanup stabilizacyjny po profilu miejsca.
  Usunieto nieuzywany `renderLocationDetailProfileLegacy` z
  `static/js/locations.js`, zeby szczegol miejsca mial jedna aktywna sciezke
  renderowania. Weryfikacja lokalna: `tools/smoke_js.mjs` przez Node REPL MCP
  oraz `git diff --check` przeszly.
- Ostatnio domkniete i wypchniete na GitHub w commicie `67288d7 Enhance
  location detail profile`: profil miejsca jako mini-historia. Endpoint
  `/api/locations/<id>` zwraca teraz `first_visit`, osobne liczniki wizyt
  bezposrednich i przez miejsca podrzedne, liste `children` oraz obiekt
  `quality` z brakami danych. Frontend szczegolu miejsca pokazuje "Paszport
  miejsca", status kompletnosci, szybkie akcje uzupelniania GPS/adresu/notatek,
  metryki pierwszej/ostatniej wizyty, miejsca podrzedne i jedna historie wizyt.
- Weryfikacja profilu miejsca: lokalnie przeszly `python -m py_compile ...`,
  `python -m ruff check .`, `python -m unittest discover -s tests` (58 testow,
  7 skipow), `tools/smoke_js.mjs` przez Node REPL MCP oraz `git diff --check`.
  GitHub Actions dla `67288d7` byly zielone. Pierwszy produkcyjny smoke mial
  timeout na `/healthz`, ale pozostale endpointy byly OK; ponowienie
  `python tools/smoke_prod.py` przeszlo 12/12 OK i potwierdzilo build
  `67288d7`.
- Ostatnio domkniete i wypchniete na GitHub w commicie `64ad250 Enhance travel
  yearbook`: `Rocznik podrozy 2.0` w statystykach. Backend `_yearbook()` zwraca
  teraz krotka narracje roku (`story`), `featured_trip`, pelny rytm miesiecy
  (`months`) oraz liczniki nowych/powrotnych krajow przed przycieciem chipow.
  Frontend pokazuje na poczatku kazdego rozdzialu charakter roku, metryki,
  "Podroz roku" i miniwykres miesiecy, a dopiero potem dotychczasowe highlighty,
  kraje i wybrane podroze.
- Weryfikacja Rocznika 2.0: lokalnie przeszly `python -m py_compile ...`,
  `python -m ruff check .`, `python -m unittest discover -s tests` (58 testow,
  7 skipow), `tools/smoke_js.mjs` przez Node REPL MCP oraz `git diff --check`.
  GitHub Actions dla `64ad250` byly zielone, a produkcyjny
  `python tools/smoke_prod.py` przeszedl 12/12 OK i potwierdzil build
  `64ad250`. Proba wizualnego fixture w in-app Browser zostala zablokowana
  przez polityke przegladarki dla `data:` i lokalnego `file://`, wiec browser
  E2E nadal nie jest wykonany lokalnie.
- Ostatnio domkniete lokalnie: pakiet `1+2` dla centrum brakow miejsc. Backend
  `/api/locations/todo` uzywa teraz preagregowanego `visit_count` z CTE
  `location_visit_counts`, bez szerokiego `GROUP BY` po miejscach i bez
  liczenia usunietych podrozy jako aktywnych wizyt. Frontend dodal szybkie
  akcje na kartach brakow: `GPS`, `Adres`, `Notatki` otwieraja edycje miejsca
  z fokusem na odpowiednim polu, a `Wizyty` otwiera szczegol miejsca.
- Weryfikacja lokalna pakietu `1+2`: `python -m py_compile ...`,
  `python -m ruff check .`, `python -m unittest discover -s tests` (58 testow,
  7 skipow), `tools/smoke_js.mjs` przez Node REPL MCP oraz `git diff --check`
  przeszly. Nowy `/api/locations/todo` przeszedl na realnym `DATABASE_URL`:
  709 miejsc, 542 wymagajace uwagi. Porownanie SQL na Neon: stary wariant
  medianowo ok. 68.05 ms, nowy ok. 67.39 ms.
- Ostatnio domkniete i wypchniete na GitHub w commicie `a5645be Improve
  location data quality worklist`: UX centrum brakow danych miejsc
  `#/locations/todo`. Widok pamieta filtr i sortowanie, obsluguje deep linki z
  query stringiem (`missing`, `sort`), sortuje po priorytecie albo wybranym
  trybie, pokazuje licznik wysokiego priorytetu oraz kolorowe etykiety typow
  brakow na kartach.
- Weryfikacja tej zmiany: zwykly `node` w PATH nadal zwraca `Odmowa dostepu`,
  wiec `tools/smoke_js.mjs` uruchomiono przez Node REPL MCP; test przeszedl.
  Przeszly tez `python -m py_compile ...`, `python -m ruff check .`,
  `python -m unittest discover -s tests` (57 testow, 7 skipow) oraz
  `git diff --check`. Po pushu GitHub Actions dla `a5645be` byly zielone, a
  produkcyjny `python tools/smoke_prod.py` przeszedl 12/12 OK i potwierdzil
  build `a5645be`.
- Ostatnia poprawka po uwadze o wolniejszym ladowaniu danych: commit `6916fa2
  Speed up location worklist sorting` zoptymalizowal klientowe sortowanie
  `#/locations/todo`. Przyczyna byla w komparatorze priorytetu, ktory dla
  kilkuset miejsc wielokrotnie tworzyl `Set` i odpalal `localeCompare`. Teraz
  rekord sortowania jest przygotowywany raz, a polskie porownania tekstu
  uzywaja jednego `Intl.Collator`. Syntetyczny benchmark 543 rekordow spadl ok.
  z 81 ms mediany do ok. 1 ms. GitHub Actions dla `6916fa2` byly zielone, a
  produkcyjny smoke po redeployu przeszedl 12/12 OK i potwierdzil build
  `6916fa2`.
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
- `node` w normalnym PATH jest obecnie problematyczny: w poprzednich sesjach
  alias WindowsApps zwracal `Odmowa dostepu`, a w tej sesji komenda byla
  niedostepna (`CommandNotFoundException`). JS smoke da sie uruchomic przez
  Node REPL MCP, ale docelowo warto zainstalowac zwykly Node LTS w PATH.

## Best Next Topics

1. Recznie sprawdzic na produkcji dluzsza podroz w `Trasa na mapie`: przewijanie
   filtrow dni na telefonie, wybranie kilku dni z rzedu, zachowanie globalnych
   numerow etapow i powrot przez `Wszystkie`.
2. Recznie porownac na produkcji pierwsze i kolejne wejscie w `Miejsca`,
   `Miejsca do uzupelnienia` i `Mape`; kolejne optymalizacje robic tylko,
   jesli po pakietach `d771c2a` i `6c9dad1` nadal widac konkretne opoznienie.
3. Jakosc danych miejsc: kontynuowac konkretne `address`/`notes` malymi
   partiami i recznie przejrzec 142 pozostale miejsca bez GPS z raportu
   `db_geocode_remaining_20260603_135807.csv`.
4. Prawdziwe browser E2E po naprawie Node/Playwright:
   login, interakcje na liscie podrozy, undo po miekkim usunieciu, odtwarzanie
   scrolla, pull-to-refresh, szczegoly podrozy, Statystyki, Rocznik, Mapa.
5. Male domkniecie Rocznika 2.0 po obejrzeniu produkcji: ewentualny tryb
   wydruku/eksportu jednego roku albo deep link do konkretnego roku, jesli widok
   ma stac sie "pamiatkowy", a nie tylko analityczny.
6. Role admin/viewer i cache po rolach, jesli aplikacja ma byc pokazywana
   komus poza adminem.
7. Dalsze male domkniecie profilu miejsca: po recznym obejrzeniu produkcji
   dopracowac teksty/spacing albo dodac drobne deep linki z miejsc podrzednych,
   jesli bedzie to faktycznie przydatne w pracy.
8. Mala analityka kosztow: miesiace/lata z najwyzszymi kosztami albo wybrana
   waluta bazowa, jesli kosztowy obraz podrozy ma byc wazniejszy.
9. Rozszerzyc realny PostgreSQL fixture o kolejne rzadziej uzywane flow, np.
   slowniki, osoby albo przypadki FK typu hard delete miejsca uzywanego w
   `travel_locations`, gdy kolejne prace dotkna tych endpointow.
10. Alternatywnie: wrocic do importow Revolut/opisow, jesli uzytkownik chce
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
