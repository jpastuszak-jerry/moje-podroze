"""Shared backend infrastructure: DB access, JSON helpers and schema startup."""

import hashlib
import json
import os
from threading import Lock

import psycopg2
import psycopg2.extras
import psycopg2.pool
from flask import Response, g, jsonify, request
from pydantic import ValidationError
import schema_migrations


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

SCHEMA_CONSTRAINT_STATEMENTS = schema_migrations.SCHEMA_CONSTRAINT_STATEMENTS
SCHEMA_INDEX_STATEMENTS = schema_migrations.SCHEMA_INDEX_STATEMENTS
SCHEMA_MIGRATIONS = schema_migrations.SCHEMA_MIGRATIONS
run_schema_migrations = schema_migrations.run_schema_migrations


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
        return jsonify({'error': 'Nie można usunąć - pozycja jest w użyciu'}), 409
    if 'unique' in msg or 'duplicate' in msg:
        return jsonify({'error': 'Pozycja o tej nazwie już istnieje'}), 409
    return jsonify({'error': f'{default_msg}: {str(e)[:200]}'}), 500


def etag_json(payload):
    """Return JSON with a strong ETag and 304 support for fresh clients."""
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
    """Consistent Pydantic validation error shape for the API."""
    first = e.errors()[0] if e.errors() else {}
    field = '.'.join(str(p) for p in first.get('loc', [])) or 'pole'
    return jsonify({
        'error': f'Niepoprawne dane: {field} - {first.get("msg", "błąd walidacji")}',
        'details': e.errors(),
    }), 400


def ensure_schema():
    """Run versioned schema migrations once at process startup."""
    if not DATABASE_URL:
        return
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        with conn.cursor() as cur:
            applied_now = run_schema_migrations(cur)
        conn.commit()
        if applied_now:
            print(f'[schema] migrations applied: {", ".join(applied_now)}')
        else:
            print(f'[schema] migrations up to date: {len(SCHEMA_MIGRATIONS)}')
    except Exception as e:
        if conn and not getattr(conn, 'closed', False):
            try:
                conn.rollback()
            except Exception as rollback_error:
                print('[schema] rollback failed:', rollback_error)
        print('[schema] migration failed:', e)
    finally:
        if conn and not getattr(conn, 'closed', False):
            conn.close()
