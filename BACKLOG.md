# Backlog

Lista rzeczy do zrobienia po ostatnich pracach nad statystykami, lista "Do uzupelnienia" i poprawkami stabilnosci. Priorytety sa praktyczne: najpierw rzeczy, ktore zwiekszaja wiarygodnosc danych i wygode pracy, potem wieksze zmiany architektoniczne.

## P1 - Najblizsze

### 1. Szybka edycja z listy "Do uzupelnienia"

**Problem:** lista pokazuje braki, ale klik otwiera tylko szczegoly podrozy. Uzytkownik nadal musi wejsc w edycje i znalezc odpowiednie pola.

**Propozycja:** dodac akcje przy karcie, np. "Edytuj", oraz opcjonalnie automatycznie otwierac modal edycji podrozy. Docelowo mozna podswietlac brakujace pola.

**Weryfikacja:** w Statystyki -> Jakosc danych -> Lista klik "Edytuj" przy podrozy; powinien otworzyc sie formularz tej podrozy.

### 2. Dalsze rekordy w Hall of Fame

**Do dodania:**
- najwiecej krajow w jednej podrozy,
- najczesciej odwiedzany kraj,
- najdluzsza przerwa miedzy podrozami,
- najdluzsza seria dni w trasie,
- najlepszy miesiac podrozniczy.

**Weryfikacja:** sekcja Hall of Fame pokazuje nowe kafle, a klik w rekord zwiazany z podroza otwiera jej szczegoly.

### 3. Koszty - srednie i rozklad

**Problem:** koszty sa obecnie prezentowane glownie jako suma per waluta i top najdrozszych wyjazdow.

**Do dodania:**
- sredni koszt podrozy,
- mediana kosztu podrozy,
- koszt per dzien per waluta,
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

### 5. Widok miejsc "Do uzupelnienia"

**Problem:** jakosc danych dotyczy teraz podrozy, a miejsca tez moga miec braki.

**Do dodania:**
- miejsca bez GPS,
- miejsca bez typu,
- miejsca bez kraju lub z niepelna hierarchia,
- miasta/wyspy bez wspolrzednych, ktore nie pojawia sie dobrze na mapach.

**Weryfikacja:** osobny filtr/lista pozwala szybko znalezc miejsca wymagajace poprawy.

### 6. Lepsze filtrowanie miejsc

**Do dodania:**
- filtr kraju,
- filtr typu miejsca,
- filtr "bez GPS",
- filtr "odwiedzone / nieodwiedzone",
- sortowanie po liczbie wizyt i ostatniej wizycie.

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

### 9. Autoryzacja aplikacji/API

**Problem:** endpointy API sa publiczne, jesli aplikacja jest publicznie dostepna.

**Propozycja:** dodac prosta autoryzacje haslem lub tokenem, najlepiej aktywowana przez zmienna srodowiskowa, zeby nie popsuc lokalnej pracy.

**Weryfikacja:** bez zalogowania mutacje API sa blokowane, a Render da sie skonfigurowac przez environment.

### 10. Kreator podrozy - bezpieczny zapis koncowy

**Kontekst:** nie zmieniac zasady, ze mozna swiadomie zapisac niepelna podroz. Problemem jest tylko sytuacja, gdy klik "Zapisz podroz" technicznie utworzy podroz, ale nie dopnie wszystkich miejsc/uczestnikow.

**Propozycja:** dodac endpoint transakcyjny dla finalnego zapisu kreatora albo wykrywac nieudane dopiecia i jasno informowac uzytkownika.

**Weryfikacja:** przy bledzie dopinania miejsca/uczestnika aplikacja nie udaje pelnego sukcesu.

### 11. Testy automatyczne dla logiki dat i statystyk

**Do dodania:**
- testy liczenia dni inkluzywnie,
- testy podrozy przechodzacej przez granice roku,
- testy jakosci danych,
- testy nowych/powrotnych krajow.

**Weryfikacja:** GitHub Actions uruchamia testy przy pushu i lapie regresje w statystykach.

### 12. Aktualizacja dokumentacji technicznej

**Problem:** `CLAUDE.md` opisuje starsza architekture i zawiera informacje, ktore po refaktorach sa nieaktualne.

**Do zrobienia:**
- opisac aktualny podzial backendu na blueprinty,
- usunac wzmianke o hardkodowanym `person_id=1/2` w statystykach,
- dopisac `todo.js` i `/api/stats/todo`,
- dopisac zasade: dni liczymy inkluzywnie.

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
