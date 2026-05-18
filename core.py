"""Wspólne narzędzia dla blueprintów: połączenie z bazą, helpery JSON,
walidacja, ETag, oraz idempotentne migracje schematu uruchamiane przy starcie.
"""

import hashlib
import json
import os

import psycopg2
import psycopg2.extras
from flask import Response, g, jsonify, request
from pydantic import ValidationError


DATABASE_URL = os.environ.get('DATABASE_URL')


def get_db():
    if 'db' not in g:
        g.db = psycopg2.connect(DATABASE_URL)
        g.db.autocommit = False
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db:
        if not db.closed:
            db.rollback()
        db.close()


def query(sql, params=(), one=False):
    db = get_db()
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        return cur.fetchone() if one else cur.fetchall()


def execute(sql, params=()):
    db = get_db()
    with db.cursor() as cur:
        cur.execute(sql, params)
        db.commit()
        try:
            return cur.fetchone()[0]
        except (TypeError, psycopg2.ProgrammingError):
            return None


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
        with conn.cursor() as cur:
            cur.execute("ALTER TABLE travels   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP")
            cur.execute("ALTER TABLE locations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP")
            # rating: INTEGER → NUMERIC(2,1) dla półgwiazdek (idempotentne — sprawdza obecny typ)
            cur.execute("""
                DO $$ BEGIN
                  IF (SELECT data_type FROM information_schema.columns
                      WHERE table_name = 'travels' AND column_name = 'rating') = 'integer' THEN
                    ALTER TABLE travels ALTER COLUMN rating TYPE NUMERIC(2,1) USING rating::numeric;
                  END IF;
                END $$;
            """)
        conn.close()
    except Exception as e:
        print('[schema] migration failed:', e)
