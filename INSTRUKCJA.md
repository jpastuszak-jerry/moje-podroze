# Moje Podróże – Instrukcja wdrożenia (wersja PostgreSQL)

## Co zawiera ten folder?

```
travelapp_pg/
├── app.py              ← serwer Flask z PostgreSQL
├── migrate.py          ← skrypt migracji danych SQLite → PostgreSQL
├── requirements.txt    ← zależności Python
├── Procfile            ← konfiguracja Render
├── travel.sqlite       ← Twoja baza danych (do migracji)
└── templates/
    └── index.html      ← aplikacja mobilna
```

---

## KROK 1 – Załóż bazę danych na Neon.tech (bezpłatnie)

1. Wejdź na **https://neon.tech** → kliknij **Sign Up** (możesz przez GitHub)
2. Po zalogowaniu kliknij **New Project**
3. Nazwa projektu: `moje-podroze`, region: **EU Central (Frankfurt)**
4. Kliknij **Create Project**
5. Zobaczysz **Connection String** — wygląda tak:
   ```
   postgresql://user:haslo@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
6. **Skopiuj ten string i zachowaj go** — będzie potrzebny w krokach 3 i 4

---

## KROK 2 – Zainstaluj Python na Windows (jeśli nie masz)

1. Wejdź na **https://python.org/downloads**
2. Pobierz Python 3.12 i zainstaluj
3. ⚠️ Podczas instalacji zaznacz **"Add Python to PATH"**

---

## KROK 3 – Uruchom migrację danych

Ten krok kopiuje Twoje dane z SQLite do PostgreSQL.

1. Wypakuj folder `travelapp_pg` na pulpit
2. Upewnij się że plik `travel.sqlite` jest w tym folderze
3. Otwórz **Wiersz poleceń** (cmd) — naciśnij Win+R, wpisz `cmd`
4. Przejdź do folderu:
   ```
   cd Desktop\travelapp_pg
   ```
5. Zainstaluj bibliotekę:
   ```
   pip install psycopg2-binary
   ```
6. Ustaw connection string (wklej swój z Neon.tech):
   ```
   set DATABASE_URL=postgresql://user:haslo@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
7. Uruchom migrację:
   ```
   python migrate.py
   ```
8. Powinieneś zobaczyć:
   ```
   countries: 38 wierszy
   location_types: 25 wierszy
   ...
   Migracja zakończona pomyślnie! ✓
   ```

---

## KROK 4 – Wgraj kod na GitHub

1. Wejdź na **https://github.com** → Twoje repozytorium `moje-podroze`
2. Usuń stare pliki: `app.py`, `requirements.txt`
3. Wgraj nowe pliki: `app.py`, `requirements.txt`, `Procfile`, `templates/index.html`
4. **NIE wgrywaj** pliku `travel.sqlite` — dane są już w PostgreSQL!

---

## KROK 5 – Dodaj DATABASE_URL do Render

1. Wejdź na **https://render.com** → Twoja aplikacja
2. Kliknij **Environment** w lewym menu
3. Kliknij **Add Environment Variable**
4. Key: `DATABASE_URL`
5. Value: wklej swój connection string z Neon.tech
6. Kliknij **Save Changes**
7. Render automatycznie przebuduje aplikację (~2 minuty)

---

## KROK 6 – Gotowe! 🎉

Otwórz aplikację na iPhonie. Teraz:
- ✅ Zmiany zapisane przez iPhone są trwałe
- ✅ Dane nie znikają po restarcie serwera
- ✅ Możesz edytować też przez DBeaver na laptopie

---

## Jak edytować bazę na laptopie (opcjonalnie)?

1. Pobierz **DBeaver** z https://dbeaver.io (bezpłatny)
2. Nowe połączenie → PostgreSQL
3. Wklej connection string z Neon.tech
4. Masz pełny dostęp do bazy jak w DB Browser

---

## Co jeśli chcę zaktualizować dane z laptopowego SQLite?

Jeśli zrobisz zmiany w lokalnym pliku `travel.sqlite`, uruchom ponownie:
```
set DATABASE_URL=postgresql://...
python migrate.py
```
⚠️ Uwaga: migrate.py **nadpisuje** wszystkie dane w PostgreSQL!
Używaj go tylko gdy chcesz pełną synchronizację z lokalnego SQLite.

---

## Problemy?

**"ModuleNotFoundError: psycopg2"**
→ Uruchom: `pip install psycopg2-binary`

**Aplikacja nie łączy się z bazą**
→ Sprawdź czy DATABASE_URL jest ustawiony w Render (Krok 5)

**Render pokazuje błąd przy buildzie**
→ Sprawdź zakładkę "Logs" na Render.com
