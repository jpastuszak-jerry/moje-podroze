"""
migrate.py – kopiuje dane z SQLite do PostgreSQL (Neon.tech)

Uruchomienie:
  pip install psycopg2-binary
  python migrate.py

Przed uruchomieniem ustaw zmienną środowiskową DATABASE_URL:
  Windows (cmd):
    set "DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require"
"""

import os
import sqlite3
import psycopg2

SQLITE_PATH = 'travel.sqlite'
DATABASE_URL = os.environ.get('DATABASE_URL')

if not DATABASE_URL:
    print("BŁĄD: Ustaw zmienną DATABASE_URL przed uruchomieniem!")
    print("Przykład: set DATABASE_URL=postgresql://...")
    exit(1)

print("Łączę z SQLite...")
sq = sqlite3.connect(SQLITE_PATH)
sq.row_factory = sqlite3.Row

print("Łączę z PostgreSQL...")
pg = psycopg2.connect(DATABASE_URL)
pg.autocommit = False
cur = pg.cursor()

print("Tworzę tabele...")

cur.execute("DROP TABLE IF EXISTS travel_participants CASCADE")
cur.execute("DROP TABLE IF EXISTS travel_locations CASCADE")
cur.execute("DROP TABLE IF EXISTS travels CASCADE")
cur.execute("DROP TABLE IF EXISTS locations CASCADE")
cur.execute("DROP TABLE IF EXISTS persons CASCADE")
cur.execute("DROP TABLE IF EXISTS relation_types CASCADE")
cur.execute("DROP TABLE IF EXISTS location_types CASCADE")
cur.execute("DROP TABLE IF EXISTS countries CASCADE")

cur.execute("""CREATE TABLE countries (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE)""")
cur.execute("""CREATE TABLE location_types (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE)""")
cur.execute("""CREATE TABLE relation_types (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE)""")
cur.execute("""
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    country_id INTEGER NOT NULL REFERENCES countries(id),
    location_type_id INTEGER NOT NULL REFERENCES location_types(id),
    parent_location_id INTEGER REFERENCES locations(id),
    address TEXT,
    notes TEXT
)""")
cur.execute("""
CREATE TABLE persons (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    relation_type_id INTEGER REFERENCES relation_types(id)
)""")
cur.execute("""
CREATE TABLE travels (
    id SERIAL PRIMARY KEY,
    name TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    purpose TEXT,
    has_photo_album BOOLEAN DEFAULT FALSE,
    amount NUMERIC(12,2),
    currency TEXT DEFAULT 'PLN',
    is_description_complete BOOLEAN DEFAULT FALSE,
    rating INTEGER,
    reflections TEXT,
    notes TEXT,
    number_of_flights INTEGER DEFAULT 0
)""")
cur.execute("""
CREATE TABLE travel_participants (
    travel_id INTEGER NOT NULL REFERENCES travels(id),
    person_id INTEGER NOT NULL REFERENCES persons(id),
    PRIMARY KEY (travel_id, person_id)
)""")
cur.execute("""
CREATE TABLE travel_locations (
    id SERIAL PRIMARY KEY,
    travel_id INTEGER NOT NULL REFERENCES travels(id),
    location_id INTEGER NOT NULL REFERENCES locations(id),
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    notes TEXT
)""")

BOOLEAN_COLUMNS = {'has_photo_album', 'is_description_complete'}

def clean_value(val, col):
    if val == '':
        return None
    if col in BOOLEAN_COLUMNS:
        return bool(val)
    return val

def copy_table(table, columns, sq_cur, pg_cur):
    rows = list(sq_cur.execute(f"SELECT {', '.join(columns)} FROM {table}").fetchall())
    if not rows:
        return 0

    data = [tuple(clean_value(row[c], c) for c in columns) for row in rows]

    if table == 'locations':
        id_idx = columns.index('id')
        parent_idx = columns.index('parent_location_id')
        sorted_data = []
        inserted_ids = set()
        remaining = data[:]
        while remaining:
            next_remaining = []
            progress = False
            for row in remaining:
                parent_id = row[parent_idx]
                if parent_id is None or parent_id in inserted_ids:
                    sorted_data.append(row)
                    inserted_ids.add(row[id_idx])
                    progress = True
                else:
                    next_remaining.append(row)
            remaining = next_remaining
            if not progress:
                for row in remaining:
                    row = list(row)
                    row[parent_idx] = None
                    sorted_data.append(tuple(row))
                break
        data = sorted_data

    placeholders = ','.join(['%s'] * len(columns))
    col_str = ','.join(columns)
    pg_cur.executemany(f"INSERT INTO {table} ({col_str}) VALUES ({placeholders})", data)

    if 'id' in columns:
        pg_cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), MAX(id)) FROM {table}")

    return len(data)

sq_cur = sq.cursor()
sq_cur.row_factory = sqlite3.Row

tables = [
    ('countries',           ['id', 'name']),
    ('location_types',      ['id', 'name']),
    ('relation_types',      ['id', 'name']),
    ('locations',           ['id', 'name', 'country_id', 'location_type_id', 'parent_location_id', 'address', 'notes']),
    ('persons',             ['id', 'name', 'relation_type_id']),
    ('travels',             ['id', 'name', 'start_date', 'end_date', 'purpose', 'has_photo_album',
                              'amount', 'currency', 'is_description_complete', 'rating',
                              'reflections', 'notes', 'number_of_flights']),
    ('travel_participants', ['travel_id', 'person_id']),
    ('travel_locations',    ['id', 'travel_id', 'location_id', 'arrival_date', 'departure_date', 'notes']),
]

for table, columns in tables:
    print(f"  Kopiuję {table}...", end='', flush=True)
    count = copy_table(table, columns, sq_cur, cur)
    print(f" {count} wierszy OK")

pg.commit()
print("\nMigracja zakończona pomyślnie!")
sq.close()
pg.close()
