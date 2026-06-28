"""Blueprint /api/locations: CRUD miejsc, mapa miejsc."""

import os
import time

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from core import (
    db_error_response,
    etag_json,
    execute,
    execute_rowcount,
    get_db_write_version,
    query,
    validation_error_response,
)
from schemas import (
    LocationCollectionInput,
    LocationCollectionItemInput,
    LocationCreate,
    LocationInspirationInput,
    LocationUpdate,
)


bp = Blueprint('locations', __name__)


def _env_int(name, default):
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


LOCATION_READ_CACHE_TTL_SECONDS = max(0, _env_int('LOCATION_READ_CACHE_TTL_SECONDS', 60))
_location_read_cache = {}


def clear_location_read_cache():
    _location_read_cache.clear()


def _cached_location_payload(name, builder):
    if LOCATION_READ_CACHE_TTL_SECONDS <= 0:
        return builder()

    now = time.monotonic()
    cache_key = (get_db_write_version(), id(query))
    cached = _location_read_cache.get(name)
    if (
        cached
        and cached['cache_key'] == cache_key
        and cached['expires_at'] > now
    ):
        return cached['payload']

    payload = builder()
    _location_read_cache[name] = {
        'cache_key': cache_key,
        'expires_at': now + LOCATION_READ_CACHE_TTL_SECONDS,
        'payload': payload,
    }
    return payload


LOCATION_VISIT_STATS_CTE = """
    WITH location_visit_targets AS (
        SELECT l.id AS location_id,
               tl.travel_id,
               COALESCE(tl.arrival_date, tl.departure_date, t.start_date, t.end_date) AS visit_start,
               COALESCE(tl.departure_date, tl.arrival_date, t.end_date, t.start_date) AS visit_end,
               t.name AS travel_name
        FROM travel_locations tl
        JOIN locations l ON l.id = tl.location_id AND l.deleted_at IS NULL
        JOIN travels t ON t.id = tl.travel_id AND t.deleted_at IS NULL

        UNION ALL

        SELECT parent.id AS location_id,
               tl.travel_id,
               COALESCE(tl.arrival_date, tl.departure_date, t.start_date, t.end_date) AS visit_start,
               COALESCE(tl.departure_date, tl.arrival_date, t.end_date, t.start_date) AS visit_end,
               t.name AS travel_name
        FROM travel_locations tl
        JOIN locations child ON child.id = tl.location_id AND child.deleted_at IS NULL
        JOIN locations parent ON parent.id = child.parent_location_id AND parent.deleted_at IS NULL
        JOIN travels t ON t.id = tl.travel_id AND t.deleted_at IS NULL
    ),
    location_visit_stats AS (
        SELECT location_id,
               COUNT(DISTINCT travel_id) AS visit_count,
               MIN(visit_start) AS first_visit,
               MAX(visit_end) AS last_visit,
               STRING_AGG(DISTINCT travel_name, ', ' ORDER BY travel_name) AS travel_names
        FROM location_visit_targets
        GROUP BY location_id
    )
"""


LOCATION_VISIT_COUNT_CTE = """
    WITH location_visit_targets AS (
        SELECT l.id AS location_id,
               tl.travel_id
        FROM travel_locations tl
        JOIN locations l ON l.id = tl.location_id AND l.deleted_at IS NULL
        JOIN travels t ON t.id = tl.travel_id AND t.deleted_at IS NULL

        UNION ALL

        SELECT parent.id AS location_id,
               tl.travel_id
        FROM travel_locations tl
        JOIN locations child ON child.id = tl.location_id AND child.deleted_at IS NULL
        JOIN locations parent ON parent.id = child.parent_location_id AND parent.deleted_at IS NULL
        JOIN travels t ON t.id = tl.travel_id AND t.deleted_at IS NULL
    ),
    location_visit_counts AS (
        SELECT location_id,
               COUNT(DISTINCT travel_id) AS visit_count
        FROM location_visit_targets
        GROUP BY location_id
    )
"""


def _location_quality(loc):
    checks = [
        ('missing_gps', 'brak GPS', loc.get('latitude') is None or loc.get('longitude') is None),
        ('missing_address', 'brak adresu/opisu', not (loc.get('address') or '').strip()),
        ('missing_notes', 'brak notatek', not (loc.get('notes') or '').strip()),
        ('not_visited', 'brak wizyt', int(loc.get('visit_count') or 0) == 0),
    ]
    missing = [{'key': key, 'label': label} for key, label, is_missing in checks if is_missing]
    total = len(checks)
    return {
        'complete': not missing,
        'score': int(round(((total - len(missing)) / total) * 100)),
        'missing_count': len(missing),
        'missing_keys': [item['key'] for item in missing],
        'missing': missing,
    }


INSPIRATION_STATUS_LABELS = {
    'want': 'Chce odwiedzic',
    'planning': 'W planie',
    'paused': 'Odlozone',
}

INSPIRATION_PRIORITY_LABELS = {
    1: 'Wysoki',
    2: 'Sredni',
    3: 'Niski',
}


def _stringify_fields(row, fields):
    for field in fields:
        if row.get(field):
            row[field] = str(row[field])


@bp.route('/api/locations')
def get_locations():
    q = request.args.get('q', '').strip()
    if not q:
        return etag_json(_cached_location_payload('locations', _build_locations_payload))
    return etag_json(_build_locations_payload(q))


def _build_locations_payload(q=''):
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
    return locs


@bp.route('/api/locations/todo')
def get_locations_todo():
    return etag_json(_cached_location_payload('locations_todo', _build_locations_todo_payload))


def _build_locations_todo_payload():
    rows = [dict(r) for r in query(LOCATION_VISIT_COUNT_CTE + """
        SELECT l.id, l.name, c.name AS country_name, lt.name AS location_type,
               l.address, l.notes, l.latitude, l.longitude, l.parent_location_id,
               COALESCE(vc.visit_count, 0) AS visit_count
        FROM locations l
        JOIN countries c ON l.country_id = c.id
        JOIN location_types lt ON l.location_type_id = lt.id
        LEFT JOIN location_visit_counts vc ON vc.location_id = l.id
        WHERE l.deleted_at IS NULL
        ORDER BY c.name, l.name
    """)]

    checks = [
        ('missing_gps', 'brak GPS', lambda loc: loc.get('latitude') is None or loc.get('longitude') is None),
        ('missing_address', 'brak adresu/opisu', lambda loc: not (loc.get('address') or '').strip()),
        ('missing_notes', 'brak notatek', lambda loc: not (loc.get('notes') or '').strip()),
        (
            'not_visited',
            'brak wizyt',
            lambda loc: int(loc.get('visit_count') or 0) == 0,
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
                'visit_count': int(loc.get('visit_count') or 0),
            })

    needs_attention.sort(key=lambda loc: (loc['missing_count'], loc['country_name'], loc['name']), reverse=True)
    return {
        'total': len(rows),
        'counts': counts,
        'labels': {key: label for key, label, _ in checks},
        'needs_attention': needs_attention,
    }


@bp.route('/api/location-inspirations')
def get_location_inspirations():
    return etag_json(_cached_location_payload(
        'location_inspirations',
        _build_location_inspirations_payload,
    ))


def _build_location_inspirations_payload():
    rows = [dict(r) for r in query(LOCATION_VISIT_COUNT_CTE + """,
        location_collection_names AS (
            SELECT lci.location_id,
                   COUNT(*) AS collection_count,
                   STRING_AGG(lc.name, ', ' ORDER BY lc.name) AS collection_names
            FROM location_collection_items lci
            JOIN location_collections lc ON lc.id = lci.collection_id
            GROUP BY lci.location_id
        )
        SELECT li.location_id,
               li.status,
               li.priority,
               li.season,
               li.notes AS inspiration_notes,
               li.created_at,
               li.updated_at,
               l.id,
               l.name,
               c.name AS country_name,
               lt.name AS location_type,
               l.address,
               l.notes AS location_notes,
               l.latitude,
               l.longitude,
               l.parent_location_id,
               pl.name AS parent_name,
               COALESCE(vc.visit_count, 0) AS visit_count,
               COALESCE(lcn.collection_count, 0) AS collection_count,
               lcn.collection_names
        FROM location_inspirations li
        JOIN locations l ON l.id = li.location_id
        JOIN countries c ON c.id = l.country_id
        JOIN location_types lt ON lt.id = l.location_type_id
        LEFT JOIN locations pl ON pl.id = l.parent_location_id
        LEFT JOIN location_visit_counts vc ON vc.location_id = l.id
        LEFT JOIN location_collection_names lcn ON lcn.location_id = l.id
        WHERE l.deleted_at IS NULL
        ORDER BY
            CASE li.status
                WHEN 'planning' THEN 1
                WHEN 'want' THEN 2
                ELSE 3
            END,
            li.priority,
            c.name,
            l.name
    """)]

    counts = {key: 0 for key in INSPIRATION_STATUS_LABELS}
    for row in rows:
        row['priority'] = int(row.get('priority') or 2)
        row['visit_count'] = int(row.get('visit_count') or 0)
        row['collection_count'] = int(row.get('collection_count') or 0)
        _stringify_fields(row, ('created_at', 'updated_at'))
        if row.get('status') in counts:
            counts[row['status']] += 1

    return {
        'items': rows,
        'counts': counts,
        'labels': INSPIRATION_STATUS_LABELS,
        'priority_labels': {str(key): value for key, value in INSPIRATION_PRIORITY_LABELS.items()},
    }


@bp.route('/api/location-inspirations/<int:lid>', methods=['POST', 'PUT'])
def upsert_location_inspiration(lid):
    try:
        payload = LocationInspirationInput.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)

    existing = query(
        "SELECT id FROM locations WHERE id=%s AND deleted_at IS NULL",
        (lid,),
        one=True,
    )
    if not existing:
        return jsonify({'error': 'Not found'}), 404

    try:
        execute("""
            INSERT INTO location_inspirations
                (location_id, status, priority, season, notes, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (location_id) DO UPDATE SET
                status = EXCLUDED.status,
                priority = EXCLUDED.priority,
                season = EXCLUDED.season,
                notes = EXCLUDED.notes,
                updated_at = NOW()
            RETURNING location_id
        """, (
            lid,
            payload.status,
            payload.priority,
            payload.season,
            payload.notes,
        ))
        return jsonify({'ok': True, 'location_id': lid})
    except Exception as e:
        return db_error_response(e)


@bp.route('/api/location-inspirations/<int:lid>', methods=['DELETE'])
def delete_location_inspiration(lid):
    rowcount = execute_rowcount(
        "DELETE FROM location_inspirations WHERE location_id=%s",
        (lid,),
    )
    if rowcount == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'ok': True})


@bp.route('/api/location-collections')
def get_location_collections():
    return etag_json(_cached_location_payload(
        'location_collections',
        _build_location_collections_payload,
    ))


def _build_location_collections_payload():
    rows = [dict(r) for r in query(LOCATION_VISIT_COUNT_CTE + """,
        collection_stats AS (
            SELECT lci.collection_id,
                   COUNT(*) AS item_count,
                   COUNT(*) FILTER (WHERE COALESCE(vc.visit_count, 0) > 0) AS visited_count,
                   COUNT(*) FILTER (WHERE li.location_id IS NOT NULL) AS inspiration_count
            FROM location_collection_items lci
            JOIN locations l ON l.id = lci.location_id AND l.deleted_at IS NULL
            LEFT JOIN location_visit_counts vc ON vc.location_id = l.id
            LEFT JOIN location_inspirations li ON li.location_id = l.id
            GROUP BY lci.collection_id
        )
        SELECT lc.id,
               lc.name,
               lc.description,
               lc.created_at,
               lc.updated_at,
               COALESCE(cs.item_count, 0) AS item_count,
               COALESCE(cs.visited_count, 0) AS visited_count,
               COALESCE(cs.inspiration_count, 0) AS inspiration_count
        FROM location_collections lc
        LEFT JOIN collection_stats cs ON cs.collection_id = lc.id
        ORDER BY lc.name
    """)]
    for row in rows:
        for key in ('item_count', 'visited_count', 'inspiration_count'):
            row[key] = int(row.get(key) or 0)
        _stringify_fields(row, ('created_at', 'updated_at'))
    return {'collections': rows}


@bp.route('/api/location-collections', methods=['POST'])
def create_location_collection():
    try:
        payload = LocationCollectionInput.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)
    try:
        new_id = execute("""
            INSERT INTO location_collections (name, description, updated_at)
            VALUES (%s, %s, NOW())
            RETURNING id
        """, (payload.name, payload.description))
        return jsonify({'id': new_id, 'name': payload.name}), 201
    except Exception as e:
        return db_error_response(e)


@bp.route('/api/location-collections/<int:cid>', methods=['PUT'])
def update_location_collection(cid):
    try:
        payload = LocationCollectionInput.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)
    try:
        rowcount = execute_rowcount("""
            UPDATE location_collections
            SET name=%s, description=%s, updated_at=NOW()
            WHERE id=%s
        """, (payload.name, payload.description, cid))
        if rowcount == 0:
            return jsonify({'error': 'Not found'}), 404
        return jsonify({'ok': True})
    except Exception as e:
        return db_error_response(e)


@bp.route('/api/location-collections/<int:cid>', methods=['DELETE'])
def delete_location_collection(cid):
    rowcount = execute_rowcount("DELETE FROM location_collections WHERE id=%s", (cid,))
    if rowcount == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'ok': True})


@bp.route('/api/location-collections/<int:cid>')
def get_location_collection(cid):
    collection = query("""
        SELECT id, name, description, created_at, updated_at
        FROM location_collections
        WHERE id=%s
    """, (cid,), one=True)
    if not collection:
        return jsonify({'error': 'Not found'}), 404

    payload = dict(collection)
    _stringify_fields(payload, ('created_at', 'updated_at'))
    items = [dict(r) for r in query(LOCATION_VISIT_COUNT_CTE + """
        SELECT lci.location_id,
               lci.note,
               lci.sort_order,
               l.id,
               l.name,
               c.name AS country_name,
               lt.name AS location_type,
               l.address,
               l.latitude,
               l.longitude,
               l.parent_location_id,
               pl.name AS parent_name,
               COALESCE(vc.visit_count, 0) AS visit_count,
               li.status AS inspiration_status,
               li.priority AS inspiration_priority
        FROM location_collection_items lci
        JOIN locations l ON l.id = lci.location_id
        JOIN countries c ON c.id = l.country_id
        JOIN location_types lt ON lt.id = l.location_type_id
        LEFT JOIN locations pl ON pl.id = l.parent_location_id
        LEFT JOIN location_visit_counts vc ON vc.location_id = l.id
        LEFT JOIN location_inspirations li ON li.location_id = l.id
        WHERE lci.collection_id = %s AND l.deleted_at IS NULL
        ORDER BY lci.sort_order, c.name, l.name
    """, (cid,))]
    for item in items:
        item['visit_count'] = int(item.get('visit_count') or 0)
        if item.get('inspiration_priority') is not None:
            item['inspiration_priority'] = int(item['inspiration_priority'])
    payload['items'] = items
    return etag_json(payload)


@bp.route('/api/location-collections/<int:cid>/locations', methods=['POST'])
def add_location_to_collection(cid):
    try:
        payload = LocationCollectionItemInput.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)

    collection = query("SELECT id FROM location_collections WHERE id=%s", (cid,), one=True)
    if not collection:
        return jsonify({'error': 'Not found'}), 404
    location = query(
        "SELECT id FROM locations WHERE id=%s AND deleted_at IS NULL",
        (payload.location_id,),
        one=True,
    )
    if not location:
        return jsonify({'error': 'Not found'}), 404

    try:
        execute("""
            INSERT INTO location_collection_items
                (collection_id, location_id, note, sort_order)
            SELECT %s, %s, %s, COALESCE(MAX(sort_order), 0) + 1
            FROM location_collection_items
            WHERE collection_id=%s
            ON CONFLICT (collection_id, location_id) DO UPDATE SET
                note = EXCLUDED.note
            RETURNING location_id
        """, (cid, payload.location_id, payload.note, cid))
        return jsonify({'ok': True, 'location_id': payload.location_id}), 201
    except Exception as e:
        return db_error_response(e)


@bp.route('/api/location-collections/<int:cid>/locations/<int:lid>', methods=['DELETE'])
def remove_location_from_collection(cid, lid):
    rowcount = execute_rowcount("""
        DELETE FROM location_collection_items
        WHERE collection_id=%s AND location_id=%s
    """, (cid, lid))
    if rowcount == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'ok': True})


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
    loc['children'] = [dict(r) for r in query("""
        SELECT child.id, child.name, lt.name AS location_type,
               COUNT(DISTINCT t.id) AS visit_count,
               MAX(CASE WHEN t.id IS NOT NULL
                   THEN COALESCE(tl.departure_date, tl.arrival_date, t.end_date, t.start_date)
                   ELSE NULL
               END) AS last_visit
        FROM locations child
        JOIN location_types lt ON child.location_type_id = lt.id
        LEFT JOIN travel_locations tl ON tl.location_id = child.id
        LEFT JOIN travels t ON t.id = tl.travel_id AND t.deleted_at IS NULL
        WHERE child.parent_location_id = %s AND child.deleted_at IS NULL
        GROUP BY child.id, child.name, lt.name
        ORDER BY child.name
    """, (lid,))]
    inspiration = query("""
        SELECT status, priority, season, notes, created_at, updated_at
        FROM location_inspirations
        WHERE location_id = %s
    """, (lid,), one=True)
    loc['inspiration'] = dict(inspiration) if inspiration else None
    loc['collections'] = [dict(r) for r in query("""
        SELECT lc.id, lc.name, lc.description, lci.note, lci.sort_order
        FROM location_collection_items lci
        JOIN location_collections lc ON lc.id = lci.collection_id
        WHERE lci.location_id = %s
        ORDER BY lc.name
    """, (lid,))]

    all_visits = loc['visits'] + loc['child_visits']
    loc['visit_count'] = len({v.get('id') for v in all_visits if v.get('id') is not None})
    loc['direct_visit_count'] = len({v.get('id') for v in loc['visits'] if v.get('id') is not None})
    loc['child_visit_count'] = len({v.get('id') for v in loc['child_visits'] if v.get('id') is not None})
    visit_start_dates = [
        visit_date
        for v in all_visits
        if (visit_date := (v.get('arrival_date') or v.get('start_date') or v.get('departure_date') or v.get('end_date')))
    ]
    visit_end_dates = [
        visit_date
        for v in all_visits
        if (visit_date := (v.get('departure_date') or v.get('arrival_date') or v.get('end_date') or v.get('start_date')))
    ]
    first_visit = min(visit_start_dates, default=None)
    last_visit = max(visit_end_dates, default=None)
    loc['first_visit'] = str(first_visit) if first_visit else None
    loc['last_visit'] = str(last_visit) if last_visit else None
    loc['child_location_count'] = len(loc['children'])
    loc['quality'] = _location_quality(loc)
    if loc['inspiration']:
        loc['inspiration']['priority'] = int(loc['inspiration'].get('priority') or 2)
        _stringify_fields(loc['inspiration'], ('created_at', 'updated_at'))

    for v in loc['visits']:
        for key in ('start_date', 'end_date', 'arrival_date', 'departure_date'):
            if v.get(key):
                v[key] = str(v[key])
    for v in loc['child_visits']:
        for key in ('start_date', 'end_date', 'arrival_date', 'departure_date'):
            if v.get(key):
                v[key] = str(v[key])
    for child in loc['children']:
        child['visit_count'] = int(child.get('visit_count') or 0)
        if child.get('last_visit'):
            child['last_visit'] = str(child['last_visit'])
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
    return etag_json(_cached_location_payload('map_locations', _build_map_locations_payload))


def _build_map_locations_payload():
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
    return [dict(r) for r in rows]
