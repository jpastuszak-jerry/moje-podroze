"""
Moje Podróże — backend Flask
==============================
Aplikacja PWA do zarządzania bazą podróży, miejsc i uczestników.
Wersja: 1.0.0

Struktura pliku:
  1. SETUP        — Flask, baza danych, helpery
  2. TRAVELS      — CRUD podróży
  3. LOCATIONS    — CRUD miejsc + szczegóły + mapa
  4. POWIĄZANIA   — uczestnicy i miejsca w podróży (tabele łączące)
  5. SŁOWNIKI     — kraje, typy miejsc, osoby, typy relacji
  6. STATYSTYKI   — agregaty i raporty
"""

import os
import datetime
from datetime import date
from typing import Optional, Literal
from flask import Flask, jsonify, request, send_from_directory, g
from flask.json.provider import DefaultJSONProvider
from pydantic import BaseModel, ValidationError, field_validator
import psycopg2
import psycopg2.extras


# =============================================================================
# 1. SETUP — Flask, baza danych, helpery
# =============================================================================

class CustomJSONProvider(DefaultJSONProvider):
    """Konwertuje daty PostgreSQL do formatu YYYY-MM-DD przy serializacji JSON."""
    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()[:10]
        return super().default(obj)


app = Flask(__name__, static_folder='static', template_folder='templates')
app.json_provider_class = CustomJSONProvider
app.json = CustomJSONProvider(app)

DATABASE_URL = os.environ.get('DATABASE_URL')


def get_db():
    if 'db' not in g:
        g.db = psycopg2.connect(DATABASE_URL)
        g.db.autocommit = False
    return g.db


@app.teardown_appcontext
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


def validation_error_response(e: ValidationError):
    """Spójny format błędów walidacji Pydantic dla całego API."""
    first = e.errors()[0] if e.errors() else {}
    field = '.'.join(str(p) for p in first.get('loc', [])) or 'pole'
    return jsonify({
        'error': f'Niepoprawne dane: {field} — {first.get("msg", "błąd walidacji")}',
        'details': e.errors(),
    }), 400


# ── Schematy walidacji wejścia (Pydantic) ──

def _blank_to_none(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


class TravelCreate(BaseModel):
    name: str = ''
    start_date: date
    end_date: date
    purpose: str = ''
    has_photo_album: bool = False
    amount: float = 0
    currency: str = 'PLN'
    is_description_complete: bool = False
    rating: Optional[int] = None
    reflections: Optional[str] = None
    notes: Optional[str] = None
    number_of_flights: int = 0

    @field_validator('rating', mode='before')
    @classmethod
    def _rating_falsy_to_none(cls, v):
        return v if v else None

    @field_validator('rating')
    @classmethod
    def _rating_range(cls, v):
        if v is not None and not (1 <= v <= 5):
            raise ValueError('rating musi być z zakresu 1–5')
        return v

    @field_validator('reflections', 'notes', mode='before')
    @classmethod
    def _strip_or_none(cls, v):
        return _blank_to_none(v)

    @field_validator('end_date')
    @classmethod
    def _end_after_start(cls, v, info):
        start = info.data.get('start_date')
        if start and v < start:
            raise ValueError('end_date nie może być wcześniejsza niż start_date')
        return v


class LocationCreate(BaseModel):
    name: str
    country_id: int
    location_type_id: int
    parent_location_id: Optional[int] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    force_duplicate: bool = False

    @field_validator('name', mode='before')
    @classmethod
    def _name_required(cls, v):
        s = (str(v).strip() if v is not None else '')
        if not s:
            raise ValueError('Podaj nazwę miejsca')
        return s

    @field_validator('address', 'notes', mode='before')
    @classmethod
    def _strip_or_none(cls, v):
        return _blank_to_none(v)


class TravelUpdate(TravelCreate):
    """Aktualizacja podróży = wszystkie pola TravelCreate + opcjonalna strategia konfliktu dat."""
    on_conflict: Optional[Literal['clip', 'ignore']] = None


class LocationUpdate(BaseModel):
    name: str
    country_id: int
    location_type_id: int
    parent_location_id: Optional[int] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @field_validator('name', mode='before')
    @classmethod
    def _name_required(cls, v):
        s = (str(v).strip() if v is not None else '')
        if not s:
            raise ValueError('Podaj nazwę miejsca')
        return s

    @field_validator('address', 'notes', mode='before')
    @classmethod
    def _strip_or_none(cls, v):
        return _blank_to_none(v)


class _TravelLocationFields(BaseModel):
    arrival_date: Optional[date] = None
    departure_date: Optional[date] = None
    notes: Optional[str] = None
    force_outside_range: bool = False

    @field_validator('notes', mode='before')
    @classmethod
    def _strip_or_none(cls, v):
        return _blank_to_none(v)

    @field_validator('departure_date')
    @classmethod
    def _depart_after_arrival(cls, v, info):
        a = info.data.get('arrival_date')
        if v and a and v < a:
            raise ValueError('departure_date nie może być wcześniej niż arrival_date')
        return v


class TravelLocationCreate(_TravelLocationFields):
    location_id: int


class TravelLocationUpdate(_TravelLocationFields):
    pass


class ParticipantAdd(BaseModel):
    person_id: int


class PersonInput(BaseModel):
    name: str
    relation_type_id: Optional[int] = None

    @field_validator('name', mode='before')
    @classmethod
    def _name_required(cls, v):
        s = (str(v).strip() if v is not None else '')
        if not s:
            raise ValueError('Podaj imię i nazwisko')
        return s


class DictItem(BaseModel):
    name: str

    @field_validator('name', mode='before')
    @classmethod
    def _name_required(cls, v):
        s = (str(v).strip() if v is not None else '')
        if not s:
            raise ValueError('Nazwa wymagana')
        return s


def register_dictionary_endpoints(table_name, url_path):
    @app.route(f'/api/{url_path}', endpoint=f'get_{url_path}')
    def list_items():
        rows = query(f"SELECT id, name FROM {table_name} ORDER BY name")
        return jsonify([dict(r) for r in rows])

    @app.route(f'/api/{url_path}', methods=['POST'], endpoint=f'create_{url_path}')
    def create_item():
        try:
            d = DictItem.model_validate(request.json or {})
        except ValidationError as e:
            return validation_error_response(e)
        try:
            new_id = execute(f"INSERT INTO {table_name} (name) VALUES (%s) RETURNING id", (d.name,))
            return jsonify({'id': new_id, 'name': d.name}), 201
        except Exception as e:
            return db_error_response(e)

    @app.route(f'/api/{url_path}/<int:item_id>', methods=['PUT'], endpoint=f'update_{url_path}')
    def update_item(item_id):
        try:
            d = DictItem.model_validate(request.json or {})
        except ValidationError as e:
            return validation_error_response(e)
        try:
            execute(f"UPDATE {table_name} SET name=%s WHERE id=%s", (d.name, item_id))
            return jsonify({'ok': True})
        except Exception as e:
            return db_error_response(e)

    @app.route(f'/api/{url_path}/<int:item_id>', methods=['DELETE'], endpoint=f'delete_{url_path}')
    def delete_item(item_id):
        try:
            execute(f"DELETE FROM {table_name} WHERE id=%s", (item_id,))
            return jsonify({'ok': True})
        except Exception as e:
            return db_error_response(e)


@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')


# =============================================================================
# 2. TRAVELS — CRUD podróży
# =============================================================================

@app.route('/api/travels')
def get_travels():
    q = request.args.get('q', '').strip()
    if q:
        rows = query("""
            SELECT * FROM travels
            WHERE name ILIKE %s OR purpose ILIKE %s OR notes ILIKE %s OR reflections ILIKE %s
            ORDER BY start_date DESC
        """, (f'%{q}%',) * 4)
    else:
        rows = query("SELECT * FROM travels ORDER BY start_date DESC")
    return jsonify([dict(r) for r in rows])


@app.route('/api/travels/<int:tid>')
def get_travel(tid):
    row = query("SELECT * FROM travels WHERE id=%s", (tid,), one=True)
    if not row:
        return jsonify({'error': 'Not found'}), 404
    travel = dict(row)
    travel['locations'] = [dict(r) for r in query("""
        SELECT tl.id, l.id AS location_id, l.name AS location_name, c.name AS country_name,
               lt.name AS location_type, tl.arrival_date, tl.departure_date, tl.notes
        FROM travel_locations tl
        JOIN locations l ON tl.location_id = l.id
        JOIN countries c ON l.country_id = c.id
        JOIN location_types lt ON l.location_type_id = lt.id
        WHERE tl.travel_id = %s
        ORDER BY tl.arrival_date
    """, (tid,))]
    travel['participants'] = [dict(r) for r in query("""
        SELECT p.id, p.name, rt.name AS relation_type
        FROM travel_participants tp
        JOIN persons p ON tp.person_id = p.id
        LEFT JOIN relation_types rt ON p.relation_type_id = rt.id
        WHERE tp.travel_id = %s
        ORDER BY p.name
    """, (tid,))]
    for key in ('start_date', 'end_date'):
        if travel.get(key):
            travel[key] = str(travel[key])
    for loc in travel['locations']:
        for key in ('arrival_date', 'departure_date'):
            if loc.get(key):
                loc[key] = str(loc[key])
    return jsonify(travel)


@app.route('/api/travels', methods=['POST'])
def create_travel():
    try:
        t = TravelCreate.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)
    new_id = execute("""
        INSERT INTO travels (name, start_date, end_date, purpose, has_photo_album,
               amount, currency, is_description_complete, rating, reflections, notes, number_of_flights)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
    """, (
        t.name, t.start_date, t.end_date, t.purpose, t.has_photo_album,
        t.amount, t.currency, t.is_description_complete,
        t.rating, t.reflections, t.notes, t.number_of_flights,
    ))
    return jsonify({'id': new_id}), 201


@app.route('/api/travels/<int:tid>', methods=['PUT'])
def update_travel(tid):
    try:
        t = TravelUpdate.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)

    # Wykryj wizyty wykraczające poza nowy zakres dat podróży
    if t.on_conflict not in ('clip', 'ignore'):
        conflicts = query("""
            SELECT tl.id, l.name AS location_name,
                   tl.arrival_date, tl.departure_date
            FROM travel_locations tl
            JOIN locations l ON tl.location_id = l.id
            WHERE tl.travel_id = %s
              AND (
                (tl.arrival_date   IS NOT NULL AND (tl.arrival_date   < %s OR tl.arrival_date   > %s)) OR
                (tl.departure_date IS NOT NULL AND (tl.departure_date < %s OR tl.departure_date > %s))
              )
            ORDER BY tl.arrival_date NULLS LAST, l.name
        """, (tid, t.start_date, t.end_date, t.start_date, t.end_date))
        if conflicts:
            return jsonify({
                'error': 'Niektóre wizyty są poza nowym zakresem dat podróży',
                'conflict': True,
                'conflicts': [
                    {
                        'id': c['id'],
                        'location_name': c['location_name'],
                        'arrival_date':   str(c['arrival_date'])   if c['arrival_date']   else None,
                        'departure_date': str(c['departure_date']) if c['departure_date'] else None,
                    } for c in conflicts
                ],
            }), 409

    db = get_db()
    with db.cursor() as cur:
        cur.execute("""
            UPDATE travels SET name=%s, start_date=%s, end_date=%s, purpose=%s,
                   has_photo_album=%s, amount=%s, currency=%s, is_description_complete=%s,
                   rating=%s, reflections=%s, notes=%s, number_of_flights=%s
            WHERE id=%s
        """, (
            t.name, t.start_date, t.end_date, t.purpose, t.has_photo_album,
            t.amount, t.currency, t.is_description_complete,
            t.rating, t.reflections, t.notes, t.number_of_flights, tid,
        ))
        if t.on_conflict == 'clip':
            # Zacisnij niepuste arrival_date / departure_date do zakresu [start_date, end_date].
            # CASE zachowuje NULL-e (PostgreSQL LEAST/GREATEST ignoruje NULL).
            cur.execute("""
                UPDATE travel_locations SET
                    arrival_date   = CASE WHEN arrival_date   IS NULL THEN NULL
                                          ELSE LEAST(GREATEST(arrival_date,   %s::date), %s::date) END,
                    departure_date = CASE WHEN departure_date IS NULL THEN NULL
                                          ELSE LEAST(GREATEST(departure_date, %s::date), %s::date) END
                WHERE travel_id = %s
                  AND (
                    (arrival_date   IS NOT NULL AND (arrival_date   < %s OR arrival_date   > %s)) OR
                    (departure_date IS NOT NULL AND (departure_date < %s OR departure_date > %s))
                  )
            """, (t.start_date, t.end_date, t.start_date, t.end_date, tid,
                  t.start_date, t.end_date, t.start_date, t.end_date))
        db.commit()
    return jsonify({'ok': True})


@app.route('/api/travels/<int:tid>', methods=['DELETE'])
def delete_travel(tid):
    db = get_db()
    with db.cursor() as cur:
        cur.execute("DELETE FROM travel_participants WHERE travel_id=%s", (tid,))
        cur.execute("DELETE FROM travel_locations WHERE travel_id=%s", (tid,))
        cur.execute("DELETE FROM travels WHERE id=%s", (tid,))
        db.commit()
    return jsonify({'ok': True})


# =============================================================================
# 3. LOCATIONS — CRUD miejsc + szczegóły + mapa
# =============================================================================

@app.route('/api/locations')
def get_locations():
    q = request.args.get('q', '').strip()
    base_sql = """
            SELECT l.id, l.name, c.name AS country_name, lt.name AS location_type,
                   l.address, l.notes, l.parent_location_id, pl.name AS parent_name
            FROM locations l
            JOIN countries c ON l.country_id = c.id
            JOIN location_types lt ON l.location_type_id = lt.id
            LEFT JOIN locations pl ON l.parent_location_id = pl.id
    """
    if q:
        rows = query(base_sql + "WHERE l.name ILIKE %s OR c.name ILIKE %s ORDER BY c.name, l.name",
                     (f'%{q}%', f'%{q}%'))
    else:
        rows = query(base_sql + "ORDER BY c.name, l.name")
    return jsonify([dict(r) for r in rows])


@app.route('/api/locations/<int:lid>')
def get_location(lid):
    row = query("""
        SELECT l.id, l.name, l.country_id, l.location_type_id, l.parent_location_id,
               c.name AS country_name, lt.name AS location_type,
               l.address, l.notes, l.latitude, l.longitude, pl.name AS parent_name
        FROM locations l
        JOIN countries c ON l.country_id = c.id
        JOIN location_types lt ON l.location_type_id = lt.id
        LEFT JOIN locations pl ON l.parent_location_id = pl.id
        WHERE l.id = %s
    """, (lid,), one=True)
    if not row:
        return jsonify({'error': 'Not found'}), 404
    loc = dict(row)
    loc['visits'] = [dict(r) for r in query("""
        SELECT t.id, t.name AS travel_name, t.start_date, t.end_date,
               tl.arrival_date, tl.departure_date, tl.notes
        FROM travel_locations tl
        JOIN travels t ON tl.travel_id = t.id
        WHERE tl.location_id = %s
        ORDER BY t.start_date
    """, (lid,))]
    loc['visit_count'] = len(loc['visits'])
    loc['child_visits'] = [dict(r) for r in query("""
        SELECT t.id, t.name AS travel_name, t.start_date, t.end_date,
               l.id AS child_location_id, l.name AS child_location_name,
               tl.arrival_date, tl.departure_date
        FROM travel_locations tl
        JOIN travels t ON tl.travel_id = t.id
        JOIN locations l ON tl.location_id = l.id
        WHERE l.parent_location_id = %s
        ORDER BY t.start_date, l.name
    """, (lid,))]
    for v in loc['visits']:
        for key in ('start_date', 'end_date', 'arrival_date', 'departure_date'):
            if v.get(key):
                v[key] = str(v[key])
    for v in loc['child_visits']:
        for key in ('start_date', 'end_date', 'arrival_date', 'departure_date'):
            if v.get(key):
                v[key] = str(v[key])
    return jsonify(loc)


@app.route('/api/locations', methods=['POST'])
def create_location():
    try:
        loc = LocationCreate.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)
    if not loc.force_duplicate:
        existing = query("""
            SELECT l.id, l.name, c.name AS country_name, lt.name AS location_type
            FROM locations l
            JOIN countries c ON l.country_id = c.id
            JOIN location_types lt ON l.location_type_id = lt.id
            WHERE LOWER(l.name) = LOWER(%s)
              AND l.country_id = %s
              AND COALESCE(l.parent_location_id, 0) = COALESCE(%s, 0)
            LIMIT 1
        """, (loc.name, loc.country_id, loc.parent_location_id), one=True)
        if existing:
            return jsonify({
                'error': 'Takie miejsce już istnieje',
                'duplicate': True,
                'existing': dict(existing),
            }), 409
    try:
        # GEO: 0.0 traktujemy jako brak współrzędnych (zachowanie sprzed Pydantica)
        lat = loc.latitude if loc.latitude not in (None, 0) else None
        lng = loc.longitude if loc.longitude not in (None, 0) else None
        new_id = execute("""
            INSERT INTO locations
                (name, country_id, location_type_id, parent_location_id, address, notes, latitude, longitude)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (
            loc.name, loc.country_id, loc.location_type_id,
            loc.parent_location_id, loc.address, loc.notes, lat, lng,
        ))
        return jsonify({'id': new_id, 'name': loc.name}), 201
    except Exception as e:
        return db_error_response(e)


@app.route('/api/locations/<int:lid>', methods=['PUT'])
def update_location(lid):
    try:
        loc = LocationUpdate.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)
    try:
        # GEO: 0.0 traktujemy jako brak współrzędnych (zachowanie sprzed Pydantica)
        lat = loc.latitude  if loc.latitude  not in (None, 0) else None
        lng = loc.longitude if loc.longitude not in (None, 0) else None
        execute("""
            UPDATE locations SET
                name=%s, country_id=%s, location_type_id=%s,
                parent_location_id=%s, address=%s, notes=%s,
                latitude=%s, longitude=%s
            WHERE id=%s
        """, (
            loc.name, loc.country_id, loc.location_type_id,
            loc.parent_location_id, loc.address, loc.notes, lat, lng, lid,
        ))
        return jsonify({'ok': True})
    except Exception as e:
        return db_error_response(e)


@app.route('/api/locations/<int:lid>', methods=['DELETE'])
def delete_location(lid):
    try:
        execute("DELETE FROM locations WHERE id=%s", (lid,))
        return jsonify({'ok': True})
    except Exception as e:
        return db_error_response(e)


@app.route('/api/map-locations')
def get_map_locations():
    rows = query("""
        SELECT l.id, l.name, l.latitude, l.longitude,
               l.address, l.notes,
               c.name AS country_name,
               lt.name AS location_type,
               COUNT(DISTINCT tl.travel_id) AS visit_count,
               MIN(t.start_date) AS first_visit,
               MAX(t.start_date) AS last_visit,
               STRING_AGG(DISTINCT t.name, ', ' ORDER BY t.name) AS travel_names
        FROM locations l
        JOIN countries c ON l.country_id = c.id
        JOIN location_types lt ON l.location_type_id = lt.id
        LEFT JOIN locations child ON (child.id = l.id OR child.parent_location_id = l.id)
        LEFT JOIN travel_locations tl ON tl.location_id = child.id
        LEFT JOIN travels t ON tl.travel_id = t.id
        WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL
        GROUP BY l.id, l.name, l.latitude, l.longitude,
                 l.address, l.notes, c.name, lt.name
        ORDER BY c.name, l.name
    """)
    return jsonify([dict(r) for r in rows])


# =============================================================================
# 4. POWIĄZANIA — uczestnicy i miejsca w podróży
# =============================================================================

def _visit_out_of_travel_range(tid, arrival, departure):
    """Zwraca dict z zakresem podróży jeśli daty wizyty są poza zakresem; inaczej None."""
    if not arrival and not departure:
        return None
    travel = query("SELECT start_date, end_date FROM travels WHERE id=%s", (tid,), one=True)
    if not travel:
        return None
    s, e = travel['start_date'], travel['end_date']
    bad = (arrival   is not None and (arrival   < s or arrival   > e)) or \
          (departure is not None and (departure < s or departure > e))
    if not bad:
        return None
    return {'travel_start': str(s), 'travel_end': str(e)}


def _out_of_range_response(info):
    return jsonify({
        'error': f'Daty wizyty są poza zakresem podróży ({info["travel_start"]} – {info["travel_end"]})',
        'out_of_range': True,
        'travel_start': info['travel_start'],
        'travel_end':   info['travel_end'],
    }), 409


@app.route('/api/travels/<int:tid>/locations', methods=['POST'])
def add_location_to_travel(tid):
    try:
        v = TravelLocationCreate.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)
    if not v.force_outside_range:
        oor = _visit_out_of_travel_range(tid, v.arrival_date, v.departure_date)
        if oor:
            return _out_of_range_response(oor)
    try:
        new_id = execute("""
            INSERT INTO travel_locations
                (travel_id, location_id, arrival_date, departure_date, notes)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
        """, (tid, v.location_id, v.arrival_date, v.departure_date, v.notes))
        return jsonify({'id': new_id}), 201
    except Exception as e:
        return db_error_response(e)


@app.route('/api/travels/<int:tid>/locations/<int:tlid>', methods=['DELETE'])
def remove_location_from_travel(tid, tlid):
    execute("DELETE FROM travel_locations WHERE id=%s AND travel_id=%s", (tlid, tid))
    return jsonify({'ok': True})


@app.route('/api/travels/<int:tid>/locations/<int:tlid>', methods=['PUT'])
def update_location_in_travel(tid, tlid):
    try:
        v = TravelLocationUpdate.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)
    if not v.force_outside_range:
        oor = _visit_out_of_travel_range(tid, v.arrival_date, v.departure_date)
        if oor:
            return _out_of_range_response(oor)
    try:
        execute("""
            UPDATE travel_locations SET arrival_date=%s, departure_date=%s, notes=%s
            WHERE id=%s AND travel_id=%s
        """, (v.arrival_date, v.departure_date, v.notes, tlid, tid))
        return jsonify({'ok': True})
    except Exception as e:
        return db_error_response(e)


@app.route('/api/travels/<int:tid>/participants', methods=['POST'])
def add_participant_to_travel(tid):
    try:
        p = ParticipantAdd.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)
    try:
        execute("""
            INSERT INTO travel_participants (travel_id, person_id)
            VALUES (%s, %s) ON CONFLICT DO NOTHING
        """, (tid, p.person_id))
        return jsonify({'ok': True}), 201
    except Exception as e:
        return db_error_response(e)


@app.route('/api/travels/<int:tid>/participants/<int:pid>', methods=['DELETE'])
def remove_participant_from_travel(tid, pid):
    execute(
        "DELETE FROM travel_participants WHERE travel_id=%s AND person_id=%s",
        (tid, pid)
    )
    return jsonify({'ok': True})


# =============================================================================
# 5. SŁOWNIKI — kraje, typy miejsc, osoby, typy relacji
# =============================================================================

register_dictionary_endpoints('countries',      'countries')
register_dictionary_endpoints('location_types', 'location_types')
register_dictionary_endpoints('relation_types', 'relation_types')


@app.route('/api/persons')
def get_persons():
    rows = query("""
        SELECT p.id, p.name, p.relation_type_id, rt.name AS relation_type
        FROM persons p
        LEFT JOIN relation_types rt ON p.relation_type_id = rt.id
        ORDER BY p.name
    """)
    return jsonify([dict(r) for r in rows])


@app.route('/api/persons', methods=['POST'])
def create_person():
    try:
        p = PersonInput.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)
    try:
        new_id = execute("""
            INSERT INTO persons (name, relation_type_id)
            VALUES (%s, %s) RETURNING id
        """, (p.name, p.relation_type_id))
        return jsonify({'id': new_id, 'name': p.name}), 201
    except Exception as e:
        return db_error_response(e)


@app.route('/api/persons/<int:pid>', methods=['PUT'])
def update_person(pid):
    try:
        p = PersonInput.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)
    try:
        execute("""
            UPDATE persons SET name=%s, relation_type_id=%s WHERE id=%s
        """, (p.name, p.relation_type_id, pid))
        return jsonify({'ok': True})
    except Exception as e:
        return db_error_response(e)


@app.route('/api/persons/<int:pid>', methods=['DELETE'])
def delete_person(pid):
    try:
        execute("DELETE FROM persons WHERE id=%s", (pid,))
        return jsonify({'ok': True})
    except Exception as e:
        return db_error_response(e)


# =============================================================================
# 6. STATYSTYKI — agregaty i raporty
# =============================================================================

@app.route('/api/stats')
def get_stats():
    travels = [dict(r) for r in query("SELECT * FROM travels")]
    countries_count = query("""
        SELECT COUNT(DISTINCT c.id) AS cnt FROM locations l
        JOIN countries c ON l.country_id = c.id
        JOIN travel_locations tl ON tl.location_id = l.id
    """, one=True)['cnt']
    locations_count = query("SELECT COUNT(*) AS cnt FROM locations", one=True)['cnt']

    total_days = 0
    total_amount = 0.0
    ratings = []
    flights = 0
    albums = 0
    purposes = {}

    for t in travels:
        try:
            s = t['start_date'] if isinstance(t['start_date'], date) \
                else date.fromisoformat(str(t['start_date']))
            e = t['end_date'] if isinstance(t['end_date'], date) \
                else date.fromisoformat(str(t['end_date']))
            total_days += (e - s).days
        except Exception:
            pass
        total_amount += float(t.get('amount') or 0)
        if t.get('rating'):
            ratings.append(t['rating'])
        flights += int(t.get('number_of_flights') or 0)
        if t.get('has_photo_album'):
            albums += 1
        purpose = t.get('purpose') or 'Inne'
        purposes[purpose] = purposes.get(purpose, 0) + 1

    participation = query("""
        SELECT
          SUM(CASE WHEN jarek=1 AND hanna=0 THEN 1 ELSE 0 END) AS sam,
          SUM(CASE WHEN jarek=0 AND hanna=1 THEN 1 ELSE 0 END) AS hanna_solo,
          SUM(CASE WHEN jarek=1 AND hanna=1 THEN 1 ELSE 0 END) AS razem,
          SUM(CASE WHEN jarek=0 AND hanna=0 THEN 1 ELSE 0 END) AS inni
        FROM (
          SELECT t.id,
            MAX(CASE WHEN tp.person_id=1 THEN 1 ELSE 0 END) AS jarek,
            MAX(CASE WHEN tp.person_id=2 THEN 1 ELSE 0 END) AS hanna
          FROM travels t
          LEFT JOIN travel_participants tp ON t.id = tp.travel_id
          GROUP BY t.id
        ) sub
    """, one=True)

    top_expensive = [dict(r) for r in query("""
        SELECT name, amount, currency, start_date, end_date,
               (end_date - start_date) AS days
        FROM travels WHERE amount > 0 ORDER BY amount DESC LIMIT 10
    """)]
    for t in top_expensive:
        for k in ('start_date', 'end_date'):
            if t.get(k):
                t[k] = str(t[k])

    top_countries = [dict(r) for r in query("""
        SELECT c.name AS country, COUNT(DISTINCT tl.travel_id) AS visits
        FROM travel_locations tl
        JOIN locations l ON l.id = tl.location_id
        JOIN countries c ON c.id = l.country_id
        GROUP BY c.name ORDER BY visits DESC LIMIT 5
    """)]

    top_places = [dict(r) for r in query("""
        SELECT l.id, l.name AS location_name, c.name AS country,
               lt.name AS location_type,
               COUNT(DISTINCT tl.travel_id) AS visit_count,
               SUM(tl.departure_date - tl.arrival_date) AS days_spent
        FROM locations l
        JOIN countries c ON l.country_id = c.id
        JOIN location_types lt ON l.location_type_id = lt.id
        JOIN locations child ON (child.id = l.id OR child.parent_location_id = l.id)
        JOIN travel_locations tl ON tl.location_id = child.id
        WHERE LOWER(lt.name) IN ('miasto', 'wyspa')
        GROUP BY l.id, l.name, c.name, lt.name
        ORDER BY visit_count DESC, days_spent DESC LIMIT 5
    """)]

    by_year = [dict(r) for r in query("""
        SELECT EXTRACT(YEAR FROM start_date)::int AS year, COUNT(*) AS count
        FROM travels GROUP BY year ORDER BY year
    """)]

    by_month = [dict(r) for r in query("""
        SELECT EXTRACT(MONTH FROM start_date)::int AS month, COUNT(*) AS count
        FROM travels GROUP BY month ORDER BY count DESC
    """)]

    avg_row = query("SELECT ROUND(AVG(end_date - start_date), 1) AS avg_days FROM travels", one=True)
    avg_trip_days = float(avg_row['avg_days'] or 0)

    cost_per_day = [dict(r) for r in query("""
        SELECT name, amount, currency,
               (end_date - start_date) AS days,
               ROUND(amount / NULLIF((end_date - start_date), 0), 0) AS cost_per_day
        FROM travels WHERE amount > 0 AND (end_date - start_date) > 0
        ORDER BY cost_per_day DESC LIMIT 5
    """)]

    progress = query("""
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN is_description_complete THEN 1 ELSE 0 END) AS described,
               SUM(CASE WHEN has_photo_album THEN 1 ELSE 0 END) AS with_album
        FROM travels
    """, one=True)

    def hof_row(sql):
        r = query(sql, one=True)
        return dict(r) if r else None

    hof_longest = hof_row("""
        SELECT id, name, (end_date - start_date) AS days
        FROM travels ORDER BY days DESC LIMIT 1
    """)
    hof_priciest = hof_row("""
        SELECT id, name, amount, currency
        FROM travels WHERE amount > 0 ORDER BY amount DESC LIMIT 1
    """)
    hof_best_rated = hof_row("""
        SELECT id, name, rating
        FROM travels WHERE rating IS NOT NULL ORDER BY rating DESC, start_date DESC LIMIT 1
    """)
    hof_most_places = hof_row("""
        SELECT t.id, t.name, COUNT(tl.id) AS loc_count
        FROM travels t JOIN travel_locations tl ON tl.travel_id = t.id
        GROUP BY t.id, t.name ORDER BY loc_count DESC LIMIT 1
    """)
    hof_most_flights = hof_row("""
        SELECT id, name, number_of_flights
        FROM travels WHERE number_of_flights > 0 ORDER BY number_of_flights DESC LIMIT 1
    """)

    hall_of_fame = {
        'longest':      {'id': hof_longest['id'],      'name': hof_longest['name'],      'value': int(hof_longest['days'])}           if hof_longest      else None,
        'priciest':     {'id': hof_priciest['id'],     'name': hof_priciest['name'],     'value': float(hof_priciest['amount']),     'currency': hof_priciest['currency']} if hof_priciest     else None,
        'best_rated':   {'id': hof_best_rated['id'],   'name': hof_best_rated['name'],   'value': int(hof_best_rated['rating'])}      if hof_best_rated   else None,
        'most_places':  {'id': hof_most_places['id'],  'name': hof_most_places['name'],  'value': int(hof_most_places['loc_count'])}  if hof_most_places  else None,
        'most_flights': {'id': hof_most_flights['id'], 'name': hof_most_flights['name'], 'value': int(hof_most_flights['number_of_flights'])} if hof_most_flights else None,
    }

    return jsonify({
        'total_trips': len(travels),
        'total_days': total_days,
        'countries': countries_count,
        'locations': locations_count,
        'flights': flights,
        'albums': albums,
        'avg_rating': round(sum(ratings) / len(ratings), 1) if ratings else 0,
        'avg_trip_days': avg_trip_days,
        'total_amount': round(total_amount, 2),
        'purposes': sorted(
            [{'name': k, 'count': v} for k, v in purposes.items()],
            key=lambda x: -x['count']
        ),
        'participation': {
            'sam':        int(participation['sam'] or 0),
            'hanna_solo': int(participation['hanna_solo'] or 0),
            'razem':      int(participation['razem'] or 0),
            'inni':       int(participation['inni'] or 0),
        },
        'top_expensive': top_expensive,
        'top_countries': top_countries,
        'top_places':    top_places,
        'by_year':       by_year,
        'by_month':      by_month,
        'cost_per_day':  cost_per_day,
        'progress': {
            'total':      int(progress['total'] or 0),
            'described':  int(progress['described'] or 0),
            'with_album': int(progress['with_album'] or 0),
        },
        'hall_of_fame': hall_of_fame,
    })


# =============================================================================
# Uruchomienie
# =============================================================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
