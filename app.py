"""
Moje Podróże — backend Flask
==============================
Aplikacja PWA do zarządzania bazą podróży, miejsc i uczestników.
Wersja: 1.1.0

Bootstrap aplikacji: Flask, blueprints, /, /sw.js, /healthz, /api/trash, /api/export.
Logika domenowa siedzi w blueprintach (travels, locations, dicts, stats).
Wspólne narzędzia w core.py, walidatory w schemas.py.
"""

import datetime
import json
import os
from datetime import date

from flask import Flask, Response, jsonify, send_from_directory
from flask.json.provider import DefaultJSONProvider

import dicts
import locations
import stats
import travels
from core import close_db, ensure_schema, query


class CustomJSONProvider(DefaultJSONProvider):
    """Konwertuje daty PostgreSQL do formatu YYYY-MM-DD przy serializacji JSON."""
    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()[:10]
        return super().default(obj)


app = Flask(__name__, static_folder='static', template_folder='templates')
app.json_provider_class = CustomJSONProvider
app.json = CustomJSONProvider(app)
app.teardown_appcontext(close_db)

ensure_schema()

app.register_blueprint(travels.bp)
app.register_blueprint(locations.bp)
app.register_blueprint(dicts.bp)
app.register_blueprint(stats.bp)


@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')


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
    latest_mtime = 0.0
    skip_names = {'sw.js'}

    for root, _, files in os.walk(static_dir):
        for f in files:
            if f in skip_names:
                continue
            full = os.path.join(root, f)
            rel = os.path.relpath(full, app.root_path).replace(os.sep, '/')
            shell.append('/' + rel)
            mt = os.path.getmtime(full)
            if mt > latest_mtime:
                latest_mtime = mt

    shell.extend(_SW_CDN_SHELL)
    version = f'v{int(latest_mtime)}'

    with open(os.path.join(static_dir, 'sw.js'), 'r', encoding='utf-8') as fh:
        content = fh.read()
    content = content.replace("'__VERSION__'", json.dumps(version))
    content = content.replace("'__APP_SHELL__'", json.dumps(shell))

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


@app.route('/api/export')
def export_database():
    """Pełny dump bazy do JSON — backup awaryjny niezależny od Neon snapshotów."""
    # travel_participants ma composite PK (travel_id, person_id), bez kolumny id
    table_orders = {
        'countries':           'id',
        'location_types':      'id',
        'relation_types':      'id',
        'persons':             'id',
        'locations':           'id',
        'travels':             'id',
        'travel_locations':    'id',
        'travel_participants': 'travel_id, person_id',
    }
    data = {t: [dict(r) for r in query(f'SELECT * FROM {t} ORDER BY {ord_col}')]
            for t, ord_col in table_orders.items()}

    response = jsonify({
        'exported_at': datetime.datetime.utcnow().isoformat() + 'Z',
        'version':     '1.0',
        'tables':      data,
    })
    response.headers['Content-Disposition'] = (
        f'attachment; filename=podroze-backup-{date.today().isoformat()}.json'
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
