"""Wspólne narzędzia dla blueprintów: połączenie z bazą, helpery JSON,
walidacja, ETag, oraz idempotentne migracje schematu uruchamiane przy starcie.
"""

import hashlib
import json
import os
from threading import Lock

import psycopg2
import psycopg2.extras
import psycopg2.pool
from flask import Response, g, jsonify, request
from pydantic import ValidationError


DATABASE_URL = os.environ.get('DATABASE_URL')


def _env_int(name, default):
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


DB_POOL_MINCONN = max(1, _env_int('DB_POOL_MINCONN', 1))
DB_POOL_MAXCONN = max(DB_POOL_MINCONN, _env_int('DB_POOL_MAXCONN', 5))

_db_pool = None
_db_pool_lock = Lock()
_db_write_version = 0
_db_write_lock = Lock()


SCHEMA_INDEX_STATEMENTS = (
    "CREATE INDEX IF NOT EXISTS idx_travel_locations_travel_id ON travel_locations (travel_id)",
    "CREATE INDEX IF NOT EXISTS idx_travel_locations_location_id ON travel_locations (location_id)",
    "CREATE INDEX IF NOT EXISTS idx_travel_participants_travel_id ON travel_participants (travel_id)",
    "CREATE INDEX IF NOT EXISTS idx_travel_participants_person_id ON travel_participants (person_id)",
    "CREATE INDEX IF NOT EXISTS idx_locations_parent_location_id ON locations (parent_location_id)",
    "CREATE INDEX IF NOT EXISTS idx_locations_country_id ON locations (country_id)",
    "CREATE INDEX IF NOT EXISTS idx_travels_active_start_date ON travels (start_date) WHERE deleted_at IS NULL",
    "CREATE INDEX IF NOT EXISTS idx_locations_active_country_id ON locations (country_id) WHERE deleted_at IS NULL",
)


SCHEMA_CONSTRAINT_STATEMENTS = (
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_travels_amount_non_negative'
      ) THEN
        ALTER TABLE travels
          ADD CONSTRAINT chk_travels_amount_non_negative
          CHECK (amount IS NULL OR amount >= 0) NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_travels_currency_iso'
      ) THEN
        ALTER TABLE travels
          ADD CONSTRAINT chk_travels_currency_iso
          CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$') NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_travels_dates_order'
      ) THEN
        ALTER TABLE travels
          ADD CONSTRAINT chk_travels_dates_order
          CHECK (end_date >= start_date) NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_travels_rating_half_step'
      ) THEN
        ALTER TABLE travels
          ADD CONSTRAINT chk_travels_rating_half_step
          CHECK (
            rating IS NULL OR (
              rating >= 0.5 AND rating <= 5
              AND rating * 2 = ROUND(rating * 2)
            )
          ) NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_travels_flights_non_negative'
      ) THEN
        ALTER TABLE travels
          ADD CONSTRAINT chk_travels_flights_non_negative
          CHECK (number_of_flights IS NULL OR number_of_flights >= 0) NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_travel_locations_dates_order'
      ) THEN
        ALTER TABLE travel_locations
          ADD CONSTRAINT chk_travel_locations_dates_order
          CHECK (
            arrival_date IS NULL OR departure_date IS NULL
            OR departure_date >= arrival_date
          ) NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_locations_latitude_bounds'
      ) THEN
        ALTER TABLE locations
          ADD CONSTRAINT chk_locations_latitude_bounds
          CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)) NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_locations_longitude_bounds'
      ) THEN
        ALTER TABLE locations
          ADD CONSTRAINT chk_locations_longitude_bounds
          CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)) NOT VALID;
      END IF;
    END $$;
    """,
    """
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_locations_parent_not_self'
      ) THEN
        ALTER TABLE locations
          ADD CONSTRAINT chk_locations_parent_not_self
          CHECK (parent_location_id IS NULL OR parent_location_id <> id) NOT VALID;
      END IF;
    END $$;
    """,
)


def get_db_pool():
    global _db_pool
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL is not configured')
    if _db_pool is None:
        with _db_pool_lock:
            if _db_pool is None:
                _db_pool = psycopg2.pool.ThreadedConnectionPool(
                    DB_POOL_MINCONN,
                    DB_POOL_MAXCONN,
                    DATABASE_URL,
                )
    return _db_pool


def get_db():
    if 'db' not in g:
        g.db = get_db_pool().getconn()
        g.db_from_pool = True
        g.db.autocommit = False
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    db_from_pool = g.pop('db_from_pool', False)
    if db:
        if not db.closed:
            db.rollback()
        if db_from_pool and _db_pool:
            _db_pool.putconn(db, close=bool(db.closed))
        else:
            db.close()


def mark_db_write():
    global _db_write_version
    with _db_write_lock:
        _db_write_version += 1
        return _db_write_version


def get_db_write_version():
    return _db_write_version


def query(sql, params=(), one=False):
    db = get_db()
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        return cur.fetchone() if one else cur.fetchall()


def execute(sql, params=()):
    db = get_db()
    with db.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone() if cur.description else None
        result = row[0] if row else None
        db.commit()
        mark_db_write()
        return result


def execute_rowcount(sql, params=()):
    db = get_db()
    with db.cursor() as cur:
        cur.execute(sql, params)
        rowcount = cur.rowcount
        db.commit()
        mark_db_write()
        return rowcount


def clean_str(value):
    return (value or '').strip() or None


def db_error_response(e, default_msg='Błąd bazy danych'):
    msg = str(e).lower()
    if 'foreign key' in msg:
        return jsonify({'error': 'Nie można usunąć — pozycja jest w użyciu'}), 409
    if 'unique' in msg or 'duplicate' in msg:
        return jsonify({'error': 'Pozycja o tej nazwie już istnieje'}), 409
    return jsonify({'error': f'{default_msg}: {str(e)[:200]}'}), 500


def etag_json(payload):
    """Zwraca jsonify(payload) z nagłówkiem ETag, lub 304 gdy klient ma świeżą wersję.
    Strong ETag z md5 nad serializacją; Service Worker przesyła If-None-Match
    z poprzednio zapisanego ETagu (zob. sw.js networkFirstApi)."""
    raw = json.dumps(payload, sort_keys=True, default=str).encode('utf-8')
    etag = '"' + hashlib.md5(raw).hexdigest() + '"'
    if request.headers.get('If-None-Match', '') == etag:
        resp = Response(status=304)
    else:
        resp = jsonify(payload)
    resp.headers['ETag'] = etag
    resp.headers['Cache-Control'] = 'no-cache'
    return resp


def validation_error_response(e: ValidationError):
    """Spójny format błędów walidacji Pydantic dla całego API."""
    first = e.errors()[0] if e.errors() else {}
    field = '.'.join(str(p) for p in first.get('loc', [])) or 'pole'
    return jsonify({
        'error': f'Niepoprawne dane: {field} — {first.get("msg", "błąd walidacji")}',
        'details': e.errors(),
    }), 400


def ensure_schema():
    """Idempotentne migracje uruchamiane raz przy starcie procesu.
    Trzymane w kodzie zamiast Alembic, dopóki backlog #1 nie wejdzie —
    daje "no manual steps" po deployu."""
    if not DATABASE_URL:
        return
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        from psycopg2.extensions import quote_ident
        with conn.cursor() as cur:
            cur.execute("ALTER TABLE travels   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP")
            cur.execute("ALTER TABLE locations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP")
            cur.execute("ALTER TABLE locations ADD COLUMN IF NOT EXISTS latitude NUMERIC(8,5)")
            cur.execute("ALTER TABLE locations ADD COLUMN IF NOT EXISTS longitude NUMERIC(8,5)")
            # rating: INTEGER → NUMERIC(2,1) dla półgwiazdek (idempotentne).
            # Trzeba ominąć widoki zależne (np. ręcznie utworzone w bazie travel_summary):
            # zapamiętujemy ich definicje, dropujemy, robimy ALTER, recreate.
            cur.execute("""
                SELECT data_type FROM information_schema.columns
                WHERE table_name = 'travels' AND column_name = 'rating'
            """)
            row = cur.fetchone()
            if row and row[0] == 'integer':
                cur.execute("""
                    SELECT DISTINCT cl.relname::text, pg_get_viewdef(cl.oid, true) AS definition
                    FROM pg_depend d
                    JOIN pg_rewrite r ON d.objid = r.oid
                    JOIN pg_class cl ON r.ev_class = cl.oid
                    JOIN pg_attribute a ON d.refobjid = a.attrelid AND d.refobjsubid = a.attnum
                    JOIN pg_class tc ON a.attrelid = tc.oid
                    WHERE tc.relname = 'travels' AND a.attname = 'rating' AND cl.relkind = 'v'
                """)
                dependent_views = cur.fetchall()
                for vname, _ in dependent_views:
                    cur.execute(f"DROP VIEW IF EXISTS {quote_ident(vname, cur)}")
                    print(f'[schema] dropped dependent view: {vname}')
                cur.execute("ALTER TABLE travels ALTER COLUMN rating TYPE NUMERIC(2,1) USING rating::numeric")
                print('[schema] rating: INTEGER -> NUMERIC(2,1) — migracja wykonana')
                for vname, vdef in dependent_views:
                    cur.execute(f"CREATE VIEW {quote_ident(vname, cur)} AS {vdef}")
                    print(f'[schema] recreated view: {vname}')
            else:
                print(f'[schema] rating: typ={row[0] if row else "?"} — migracja niepotrzebna')
            try:
                cur.execute("""
                    SELECT data_type, numeric_precision, numeric_scale
                    FROM information_schema.columns
                    WHERE table_name = 'travels' AND column_name = 'amount'
                """)
                amount_col = cur.fetchone()
                if amount_col and amount_col != ('numeric', 12, 2):
                    cur.execute("""
                        ALTER TABLE travels
                        ALTER COLUMN amount TYPE NUMERIC(12,2)
                        USING ROUND(amount::numeric, 2)
                    """)
                    print('[schema] amount: -> NUMERIC(12,2) — migracja wykonana')
            except Exception as amount_error:
                print('[schema] amount migration skipped:', amount_error)
            for statement in SCHEMA_INDEX_STATEMENTS:
                cur.execute(statement)
            print(f'[schema] indexes ensured: {len(SCHEMA_INDEX_STATEMENTS)}')
            for statement in SCHEMA_CONSTRAINT_STATEMENTS:
                cur.execute(statement)
            print(f'[schema] constraints ensured: {len(SCHEMA_CONSTRAINT_STATEMENTS)}')
        conn.close()
    except Exception as e:
        print('[schema] migration failed:', e)
