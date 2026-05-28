"""
Moje Podróże — backend Flask
==============================
Aplikacja PWA do zarządzania bazą podróży, miejsc i uczestników.
Wersja: 1.1.0

Bootstrap aplikacji: Flask, blueprints, /, /sw.js, /healthz, /api/trash, /api/export.
Logika domenowa siedzi w blueprintach (travels, locations, dicts, stats).
Wspólne narzędzia w core.py, walidatory w schemas.py.
"""

import json
import os
import time
from datetime import date, datetime, timedelta, timezone
from hmac import compare_digest
from math import ceil
from threading import Lock

from flask import Flask, Response, jsonify, render_template, request, session
from flask.json.provider import DefaultJSONProvider
from werkzeug.security import check_password_hash

import dicts
import locations
import stats
import travels
from core import close_db, ensure_schema, query


class CustomJSONProvider(DefaultJSONProvider):
    """Konwertuje daty PostgreSQL do formatu YYYY-MM-DD przy serializacji JSON."""
    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()[:10]
        return super().default(obj)


app = Flask(__name__, static_folder='static', template_folder='templates')
app.json_provider_class = CustomJSONProvider
app.json = CustomJSONProvider(app)
app.teardown_appcontext(close_db)
app.secret_key = os.environ.get('SECRET_KEY') or os.urandom(32)
app.permanent_session_lifetime = timedelta(days=14)
_secure_cookie_env = os.environ.get('SESSION_COOKIE_SECURE')
_secure_cookie = (
    _secure_cookie_env.lower() in ('1', 'true', 'yes')
    if _secure_cookie_env is not None
    else bool(os.environ.get('RENDER'))
)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=_secure_cookie,
)

ensure_schema()

app.register_blueprint(travels.bp)
app.register_blueprint(locations.bp)
app.register_blueprint(dicts.bp)
app.register_blueprint(stats.bp)


BACKUP_SCHEMA_VERSION = '2.0'


def _env_int(name, default):
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default

EXPORT_TABLE_ORDERS = {
    'countries':           'id',
    'location_types':      'id',
    'relation_types':      'id',
    'persons':             'id',
    'locations':           'id',
    'travels':             'id',
    'travel_locations':    'id',
    'travel_participants': 'travel_id, person_id',
}

NO_STORE_EXACT_API_PATHS = {
    '/api/export',
    '/api/trash',
    '/api/locations/todo',
}

NO_STORE_API_PREFIXES = (
    '/api/auth',
    '/api/stats',
    '/api/travels',
)

ADMIN_PASSWORD_HASH = os.environ.get('ADMIN_PASSWORD_HASH')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')
AUTH_SESSION_KEY = 'admin_authenticated'
AUTH_MAX_FAILED_ATTEMPTS = max(1, _env_int('AUTH_MAX_FAILED_ATTEMPTS', 5))
AUTH_LOCKOUT_SECONDS = max(1, _env_int('AUTH_LOCKOUT_SECONDS', 15 * 60))
AUTH_FAILURE_WINDOW_SECONDS = max(1, _env_int('AUTH_FAILURE_WINDOW_SECONDS', 15 * 60))
_auth_failures = {}
_auth_failures_lock = Lock()
PUBLIC_ENDPOINTS = {
    'index',
    'service_worker',
    'healthz',
    'auth_status',
    'auth_login',
    'auth_logout',
    'static',
}


@app.route('/')
def index():
    return render_template(
        'index.html',
        asset_version=static_asset_version(),
        is_authenticated=is_admin_authenticated(),
        auth_configured=is_auth_configured(),
    )


def is_auth_configured():
    return bool(ADMIN_PASSWORD_HASH or ADMIN_PASSWORD)


def is_admin_authenticated():
    return bool(session.get(AUTH_SESSION_KEY))


def check_admin_password(password):
    if not password or not is_auth_configured():
        return False
    if ADMIN_PASSWORD_HASH:
        try:
            return check_password_hash(ADMIN_PASSWORD_HASH, password)
        except ValueError:
            return False
    return compare_digest(password, ADMIN_PASSWORD or '')


def auth_rate_limit_key():
    return request.remote_addr or 'unknown'


def auth_rate_limited_response(retry_after):
    response = jsonify({
        'error': 'Za dużo błędnych prób logowania. Spróbuj ponownie później.',
        'retry_after_seconds': retry_after,
    })
    response.status_code = 429
    response.headers['Retry-After'] = str(retry_after)
    return response


def auth_retry_after():
    key = auth_rate_limit_key()
    now = time.monotonic()
    with _auth_failures_lock:
        state = _auth_failures.get(key)
        if not state:
            return None
        locked_until = state.get('locked_until') or 0
        if locked_until > now:
            return max(1, ceil(locked_until - now))
        if locked_until:
            _auth_failures.pop(key, None)
            return None

        first_failed_at = state.get('first_failed_at') or now
        if now - first_failed_at > AUTH_FAILURE_WINDOW_SECONDS:
            _auth_failures.pop(key, None)
    return None


def record_failed_login():
    key = auth_rate_limit_key()
    now = time.monotonic()
    with _auth_failures_lock:
        state = _auth_failures.get(key) or {'count': 0, 'locked_until': 0}
        locked_until = state.get('locked_until') or 0
        if locked_until > now:
            return max(1, ceil(locked_until - now))
        if locked_until:
            state = {'count': 0, 'locked_until': 0, 'first_failed_at': now}

        first_failed_at = state.get('first_failed_at') or now
        if now - first_failed_at > AUTH_FAILURE_WINDOW_SECONDS:
            state = {'count': 0, 'locked_until': 0, 'first_failed_at': now}
            first_failed_at = now

        state['count'] = int(state.get('count') or 0) + 1
        state['first_failed_at'] = first_failed_at
        if state['count'] >= AUTH_MAX_FAILED_ATTEMPTS:
            state['locked_until'] = now + AUTH_LOCKOUT_SECONDS
            _auth_failures[key] = state
            return AUTH_LOCKOUT_SECONDS

        _auth_failures[key] = state
    return None


def clear_failed_logins():
    key = auth_rate_limit_key()
    with _auth_failures_lock:
        _auth_failures.pop(key, None)


@app.before_request
def require_admin_auth():
    if request.endpoint in PUBLIC_ENDPOINTS or request.path.startswith('/static/'):
        return None
    if is_admin_authenticated():
        return None
    if request.path.startswith('/api/'):
        return jsonify({'error': 'unauthorized'}), 401
    return None


@app.route('/api/auth/status')
def auth_status():
    return jsonify({
        'authenticated': is_admin_authenticated(),
        'configured': is_auth_configured(),
        'role': 'admin' if is_admin_authenticated() else None,
    })


@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    if not is_auth_configured():
        return jsonify({'error': 'Logowanie nie jest skonfigurowane'}), 503
    retry_after = auth_retry_after()
    if retry_after:
        return auth_rate_limited_response(retry_after)

    payload = request.get_json(silent=True) or {}
    if not check_admin_password(str(payload.get('password') or '')):
        retry_after = record_failed_login()
        if retry_after:
            return auth_rate_limited_response(retry_after)
        return jsonify({'error': 'Nieprawidłowe hasło'}), 401
    clear_failed_logins()
    session.clear()
    session.permanent = True
    session[AUTH_SESSION_KEY] = True
    return jsonify({'ok': True, 'role': 'admin'})


@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    session.clear()
    return jsonify({'ok': True})


def is_no_store_api_path(path):
    return path in NO_STORE_EXACT_API_PATHS or any(path.startswith(prefix) for prefix in NO_STORE_API_PREFIXES)


@app.after_request
def add_sensitive_cache_headers(response):
    if is_no_store_api_path(request.path) or (
        request.path.startswith('/api/') and response.status_code in (401, 403)
    ):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    elif request.endpoint == 'index' and not is_admin_authenticated():
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response


def static_asset_version():
    static_dir = os.path.join(app.root_path, 'static')
    latest_mtime = 0.0
    for root, _, files in os.walk(static_dir):
        for f in files:
            if f == 'sw.js':
                continue
            latest_mtime = max(latest_mtime, os.path.getmtime(os.path.join(root, f)))
    return f'v{int(latest_mtime)}'


_SW_CDN_SHELL = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js',
]


@app.route('/sw.js')
def service_worker():
    """Serwuje sw.js z auto-wstrzyknięciem wersji (mtime) i listy APP_SHELL
    (skan static/). Dzięki temu po deployu cache się sam unieważnia, a nowe
    pliki w static/ są automatycznie precache'owane bez ręcznych zmian."""
    static_dir = os.path.join(app.root_path, 'static')
    shell = ['/']
    shell_static = []
    version = static_asset_version()
    skip_names = {'sw.js'}

    for root, _, files in os.walk(static_dir):
        for f in files:
            if f in skip_names:
                continue
            full = os.path.join(root, f)
            rel = os.path.relpath(full, app.root_path).replace(os.sep, '/')
            shell_static.append('/' + rel)

    shell.extend(f'{url}?v={version}' for url in shell_static)
    shell.extend(_SW_CDN_SHELL)

    with open(os.path.join(static_dir, 'sw.js'), 'r', encoding='utf-8') as fh:
        content = fh.read()
    content = content.replace("'__VERSION__'", json.dumps(version))
    content = content.replace("'__APP_SHELL__'", json.dumps(shell))
    content = content.replace("'__NO_STORE_API_EXACT_PATHS__'", json.dumps(sorted(NO_STORE_EXACT_API_PATHS)))
    content = content.replace("'__NO_STORE_API_PREFIXES__'", json.dumps(list(NO_STORE_API_PREFIXES)))

    response = Response(content, mimetype='application/javascript')
    response.headers['Cache-Control'] = 'no-cache'
    return response


@app.route('/api/trash')
def get_trash():
    """Lista miękko-skasowanych podróży i miejsc — do przywracania lub trwałego usunięcia."""
    travels_rows = [dict(r) for r in query("""
        SELECT id, name, start_date, end_date, deleted_at
        FROM travels WHERE deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
    """)]
    locations_rows = [dict(r) for r in query("""
        SELECT l.id, l.name, c.name AS country_name, lt.name AS location_type, l.deleted_at
        FROM locations l
        JOIN countries c ON l.country_id = c.id
        JOIN location_types lt ON l.location_type_id = lt.id
        WHERE l.deleted_at IS NOT NULL
        ORDER BY l.deleted_at DESC
    """)]
    for t in travels_rows:
        for k in ('start_date', 'end_date', 'deleted_at'):
            if t.get(k):
                t[k] = str(t[k])
    for loc in locations_rows:
        if loc.get('deleted_at'):
            loc['deleted_at'] = str(loc['deleted_at'])
    return jsonify({'travels': travels_rows, 'locations': locations_rows})


def backup_filename(export_date):
    return f'moje-podroze-backup-{export_date}.json'


def build_backup_payload(now=None):
    now = now or datetime.now(timezone.utc)
    exported_at = now.replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    export_date = now.date().isoformat()
    data = {
        table: [dict(r) for r in query(f'SELECT * FROM {table} ORDER BY {order_by}')]
        for table, order_by in EXPORT_TABLE_ORDERS.items()
    }
    table_counts = {table: len(rows) for table, rows in data.items()}
    metadata = {
        'app': 'moje-podroze',
        'kind': 'full-database-backup',
        'schema_version': BACKUP_SCHEMA_VERSION,
        'exported_at': exported_at,
        'export_date': export_date,
        'table_order': list(EXPORT_TABLE_ORDERS.keys()),
        'table_counts': table_counts,
        'total_records': sum(table_counts.values()),
    }
    return {
        'metadata': metadata,
        'schema_version': BACKUP_SCHEMA_VERSION,
        'exported_at': exported_at,
        'version': BACKUP_SCHEMA_VERSION,
        'tables': data,
    }


@app.route('/api/export')
def export_database():
    """Pełny dump bazy do JSON — backup awaryjny niezależny od Neon snapshotów."""
    payload = build_backup_payload()
    export_date = payload['metadata']['export_date']

    response = jsonify(payload)
    response.headers['Content-Disposition'] = (
        f'attachment; filename={backup_filename(export_date)}'
    )
    return response


@app.route('/healthz')
def healthz():
    """Healthcheck dla UptimeRobot / monitoringu — pinguje DB."""
    try:
        query("SELECT 1 AS ok", one=True)
        return jsonify({'status': 'ok', 'db': 'ok'}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'db': 'down', 'detail': str(e)[:200]}), 503


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
