"""Blueprint /api/locations: CRUD miejsc, mapa miejsc."""

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from core import db_error_response, etag_json, execute, execute_rowcount, query, validation_error_response
from schemas import LocationCreate, LocationUpdate


bp = Blueprint('locations', __name__)


LOCATION_VISIT_STATS_CTE = """
    WITH location_visit_targets AS (
        SELECT l.id AS location_id,
               tl.travel_id,
               COALESCE(tl.departure_date, tl.arrival_date, t.end_date, t.start_date) AS visit_date,
               t.name AS travel_name
        FROM travel_locations tl
        JOIN locations l ON l.id = tl.location_id AND l.deleted_at IS NULL
        JOIN travels t ON t.id = tl.travel_id AND t.deleted_at IS NULL

        UNION ALL

        SELECT parent.id AS location_id,
               tl.travel_id,
               COALESCE(tl.departure_date, tl.arrival_date, t.end_date, t.start_date) AS visit_date,
               t.name AS travel_name
        FROM travel_locations tl
        JOIN locations child ON child.id = tl.location_id AND child.deleted_at IS NULL
        JOIN locations parent ON parent.id = child.parent_location_id AND parent.deleted_at IS NULL
        JOIN travels t ON t.id = tl.travel_id AND t.deleted_at IS NULL
    ),
    location_visit_stats AS (
        SELECT location_id,
               COUNT(DISTINCT travel_id) AS visit_count,
               MIN(visit_date) AS first_visit,
               MAX(visit_date) AS last_visit,
               STRING_AGG(DISTINCT travel_name, ', ' ORDER BY travel_name) AS travel_names
        FROM location_visit_targets
        GROUP BY location_id
    )
"""


@bp.route('/api/locations')
def get_locations():
    q = request.args.get('q', '').strip()
    base_sql = LOCATION_VISIT_STATS_CTE + """
            SELECT l.id, l.name, c.name AS country_name, lt.name AS location_type,
                   l.address, l.notes, l.latitude, l.longitude,
                   l.parent_location_id, pl.name AS parent_name,
                   COALESCE(vs.visit_count, 0) AS visit_count,
                   vs.last_visit
            FROM locations l
            JOIN countries c ON l.country_id = c.id
            JOIN location_types lt ON l.location_type_id = lt.id
            LEFT JOIN locations pl ON l.parent_location_id = pl.id
            LEFT JOIN location_visit_stats vs ON vs.location_id = l.id
    """
    if q:
        rows = query(base_sql + """
            WHERE l.deleted_at IS NULL AND (l.name ILIKE %s OR c.name ILIKE %s)
            ORDER BY c.name, l.name
        """, (f'%{q}%', f'%{q}%'))
    else:
        rows = query(base_sql + """
            WHERE l.deleted_at IS NULL
            ORDER BY c.name, l.name
        """)
    locs = []
    for row in rows:
        loc = dict(row)
        loc['visit_count'] = int(loc.get('visit_count') or 0)
        if loc.get('last_visit'):
            loc['last_visit'] = str(loc['last_visit'])
        locs.append(loc)
    return etag_json(locs)


@bp.route('/api/locations/todo')
def get_locations_todo():
    rows = [dict(r) for r in query("""
        SELECT l.id, l.name, c.name AS country_name, lt.name AS location_type,
               l.address, l.notes, l.latitude, l.longitude, l.parent_location_id,
               COUNT(DISTINCT tl.travel_id) AS direct_visits,
               COUNT(DISTINCT child_tl.travel_id) AS child_visits
        FROM locations l
        JOIN countries c ON l.country_id = c.id
        JOIN location_types lt ON l.location_type_id = lt.id
        LEFT JOIN travel_locations tl ON tl.location_id = l.id
        LEFT JOIN locations child ON child.parent_location_id = l.id AND child.deleted_at IS NULL
        LEFT JOIN travel_locations child_tl ON child_tl.location_id = child.id
        WHERE l.deleted_at IS NULL
        GROUP BY l.id, l.name, c.name, lt.name, l.address, l.notes,
                 l.latitude, l.longitude, l.parent_location_id
        ORDER BY c.name, l.name
    """)]

    checks = [
        ('missing_gps', 'brak GPS', lambda loc: loc.get('latitude') is None or loc.get('longitude') is None),
        ('missing_address', 'brak adresu/opisu', lambda loc: not (loc.get('address') or '').strip()),
        ('missing_notes', 'brak notatek', lambda loc: not (loc.get('notes') or '').strip()),
        (
            'not_visited',
            'brak wizyt',
            lambda loc: int(loc.get('direct_visits') or 0) == 0 and int(loc.get('child_visits') or 0) == 0,
        ),
    ]
    counts = {key: 0 for key, _, _ in checks}
    needs_attention = []

    for loc in rows:
        missing = []
        missing_keys = []
        for key, label, predicate in checks:
            if predicate(loc):
                counts[key] += 1
                missing.append(label)
                missing_keys.append(key)
        if missing:
            needs_attention.append({
                'id': loc['id'],
                'name': loc['name'],
                'country_name': loc['country_name'],
                'location_type': loc['location_type'],
                'missing': missing,
                'missing_keys': missing_keys,
                'missing_count': len(missing),
                'visit_count': int(loc.get('direct_visits') or 0) + int(loc.get('child_visits') or 0),
            })

    needs_attention.sort(key=lambda loc: (loc['missing_count'], loc['country_name'], loc['name']), reverse=True)
    return etag_json({
        'total': len(rows),
        'counts': counts,
        'labels': {key: label for key, label, _ in checks},
        'needs_attention': needs_attention,
    })


@bp.route('/api/locations/<int:lid>')
def get_location(lid):
    row = query("""
        SELECT l.id, l.name, l.country_id, l.location_type_id, l.parent_location_id,
               c.name AS country_name, lt.name AS location_type,
               l.address, l.notes, l.latitude, l.longitude, pl.name AS parent_name
        FROM locations l
        JOIN countries c ON l.country_id = c.id
        JOIN location_types lt ON l.location_type_id = lt.id
        LEFT JOIN locations pl ON l.parent_location_id = pl.id
        WHERE l.id = %s AND l.deleted_at IS NULL
    """, (lid,), one=True)
    if not row:
        return jsonify({'error': 'Not found'}), 404
    loc = dict(row)
    loc['visits'] = [dict(r) for r in query("""
        SELECT t.id, t.name AS travel_name, t.start_date, t.end_date,
               tl.arrival_date, tl.departure_date, tl.notes
        FROM travel_locations tl
        JOIN travels t ON tl.travel_id = t.id
        WHERE tl.location_id = %s AND t.deleted_at IS NULL
        ORDER BY t.start_date
    """, (lid,))]
    loc['child_visits'] = [dict(r) for r in query("""
        SELECT t.id, t.name AS travel_name, t.start_date, t.end_date,
               l.id AS child_location_id, l.name AS child_location_name,
               tl.arrival_date, tl.departure_date
        FROM travel_locations tl
        JOIN travels t ON tl.travel_id = t.id
        JOIN locations l ON tl.location_id = l.id
        WHERE l.parent_location_id = %s
          AND t.deleted_at IS NULL AND l.deleted_at IS NULL
        ORDER BY t.start_date, l.name
    """, (lid,))]

    all_visits = loc['visits'] + loc['child_visits']
    loc['visit_count'] = len({v.get('id') for v in all_visits if v.get('id') is not None})
    visit_dates = [
        visit_date
        for v in all_visits
        if (visit_date := (v.get('departure_date') or v.get('arrival_date') or v.get('end_date') or v.get('start_date')))
    ]
    last_visit = max(visit_dates, default=None)
    loc['last_visit'] = str(last_visit) if last_visit else None

    for v in loc['visits']:
        for key in ('start_date', 'end_date', 'arrival_date', 'departure_date'):
            if v.get(key):
                v[key] = str(v[key])
    for v in loc['child_visits']:
        for key in ('start_date', 'end_date', 'arrival_date', 'departure_date'):
            if v.get(key):
                v[key] = str(v[key])
    return jsonify(loc)


@bp.route('/api/locations', methods=['POST'])
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
              AND l.deleted_at IS NULL
            LIMIT 1
        """, (loc.name, loc.country_id, loc.parent_location_id), one=True)
        if existing:
            return jsonify({
                'error': 'Takie miejsce już istnieje',
                'duplicate': True,
                'existing': dict(existing),
            }), 409
    try:
        # GEO: tylko None to "brak współrzędnych"; 0.0 to ważna lokalizacja (równik / południk zerowy)
        new_id = execute("""
            INSERT INTO locations
                (name, country_id, location_type_id, parent_location_id, address, notes, latitude, longitude)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (
            loc.name, loc.country_id, loc.location_type_id,
            loc.parent_location_id, loc.address, loc.notes,
            loc.latitude, loc.longitude,
        ))
        return jsonify({'id': new_id, 'name': loc.name}), 201
    except Exception as e:
        return db_error_response(e)


@bp.route('/api/locations/<int:lid>', methods=['PUT'])
def update_location(lid):
    try:
        loc = LocationUpdate.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)
    try:
        # GEO: tylko None to "brak współrzędnych"; 0.0 to ważna lokalizacja (równik / południk zerowy)
        rowcount = execute_rowcount("""
            UPDATE locations SET
                name=%s, country_id=%s, location_type_id=%s,
                parent_location_id=%s, address=%s, notes=%s,
                latitude=%s, longitude=%s
            WHERE id=%s
        """, (
            loc.name, loc.country_id, loc.location_type_id,
            loc.parent_location_id, loc.address, loc.notes,
            loc.latitude, loc.longitude, lid,
        ))
        if rowcount == 0:
            return jsonify({'error': 'Not found'}), 404
        return jsonify({'ok': True})
    except Exception as e:
        return db_error_response(e)


@bp.route('/api/locations/<int:lid>', methods=['DELETE'])
def delete_location(lid):
    """Soft delete (deleted_at = NOW). Hard delete tylko z ?hard=1
    — jeśli miejsce jest w użyciu (FK z travel_locations), zwracamy 409."""
    if request.args.get('hard') == '1':
        try:
            if execute_rowcount("DELETE FROM locations WHERE id=%s", (lid,)) == 0:
                return jsonify({'error': 'Not found'}), 404
            return jsonify({'ok': True, 'hard': True})
        except Exception as e:
            return db_error_response(e)
    if execute_rowcount("UPDATE locations SET deleted_at = NOW() WHERE id=%s AND deleted_at IS NULL", (lid,)) == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'ok': True})


@bp.route('/api/locations/<int:lid>/restore', methods=['POST'])
def restore_location(lid):
    if execute_rowcount("UPDATE locations SET deleted_at = NULL WHERE id=%s", (lid,)) == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'ok': True})


@bp.route('/api/map-locations')
def get_map_locations():
    rows = query(LOCATION_VISIT_STATS_CTE + """
        SELECT l.id, l.name, l.latitude, l.longitude,
               l.address, l.notes,
               c.name AS country_name,
               lt.name AS location_type,
               COALESCE(vs.visit_count, 0) AS visit_count,
               vs.first_visit,
               vs.last_visit,
               vs.travel_names
        FROM locations l
        JOIN countries c ON l.country_id = c.id
        JOIN location_types lt ON l.location_type_id = lt.id
        LEFT JOIN location_visit_stats vs ON vs.location_id = l.id
        WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL
          AND l.deleted_at IS NULL
        ORDER BY c.name, l.name
    """)
    return etag_json([dict(r) for r in rows])
