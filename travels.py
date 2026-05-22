"""Blueprint /api/travels: CRUD podróży, zarządzanie miejscami w podróży i uczestnikami."""

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from core import db_error_response, execute, execute_rowcount, get_db, query, validation_error_response
from schemas import (
    ParticipantAdd,
    TravelCreate,
    TravelLocationCreate,
    TravelLocationUpdate,
    TravelUpdate,
    TravelWizardCreate,
)


bp = Blueprint('travels', __name__)


@bp.route('/api/travels')
def get_travels():
    q = request.args.get('q', '').strip()
    if q:
        rows = query("""
            SELECT * FROM travels
            WHERE deleted_at IS NULL
              AND (
                name ILIKE %s OR purpose ILIKE %s OR notes ILIKE %s OR reflections ILIKE %s
                OR EXISTS (
                  SELECT 1 FROM travel_locations tl
                  JOIN locations l ON tl.location_id = l.id
                  JOIN countries c ON l.country_id = c.id
                  WHERE tl.travel_id = travels.id
                    AND l.deleted_at IS NULL
                    AND (l.name ILIKE %s OR c.name ILIKE %s)
                )
              )
            ORDER BY start_date DESC
        """, (f'%{q}%',) * 6)
    else:
        rows = query("SELECT * FROM travels WHERE deleted_at IS NULL ORDER BY start_date DESC")
    return jsonify([dict(r) for r in rows])


@bp.route('/api/travels/<int:tid>')
def get_travel(tid):
    row = query("SELECT * FROM travels WHERE id=%s AND deleted_at IS NULL", (tid,), one=True)
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
        WHERE tl.travel_id = %s AND l.deleted_at IS NULL
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


@bp.route('/api/travels', methods=['POST'])
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


@bp.route('/api/travels/wizard', methods=['POST'])
def create_travel_from_wizard():
    try:
        payload = TravelWizardCreate.model_validate(request.json or {})
    except ValidationError as e:
        return validation_error_response(e)

    t = payload.travel
    for loc in payload.locations:
        if not loc.force_outside_range:
            oor = _visit_outside_range(t.start_date, t.end_date, loc.arrival_date, loc.departure_date)
            if oor:
                return _out_of_range_response(oor)

    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute("""
                INSERT INTO travels (name, start_date, end_date, purpose, has_photo_album,
                       amount, currency, is_description_complete, rating, reflections, notes, number_of_flights)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """, (
                t.name, t.start_date, t.end_date, t.purpose, t.has_photo_album,
                t.amount, t.currency, t.is_description_complete,
                t.rating, t.reflections, t.notes, t.number_of_flights,
            ))
            new_id = cur.fetchone()[0]

            for loc in payload.locations:
                cur.execute("""
                    INSERT INTO travel_locations
                        (travel_id, location_id, arrival_date, departure_date, notes)
                    VALUES (%s, %s, %s, %s, %s)
                """, (new_id, loc.location_id, loc.arrival_date, loc.departure_date, loc.notes))

            for participant in payload.participants:
                cur.execute("""
                    INSERT INTO travel_participants (travel_id, person_id)
                    VALUES (%s, %s) ON CONFLICT DO NOTHING
                """, (new_id, participant.person_id))

            db.commit()
    except Exception as e:
        db.rollback()
        return _wizard_save_error_response(e)

    return jsonify({
        'id': new_id,
        'locations': len(payload.locations),
        'participants': len(payload.participants),
    }), 201


def _wizard_save_error_response(e):
    msg = str(e).lower()
    if 'foreign key' in msg:
        return jsonify({
            'error': 'Nie udało się zapisać podróży — wybrane miejsce lub uczestnik nie istnieje już w bazie',
        }), 409
    return db_error_response(e, 'Nie udało się zapisać podróży')


@bp.route('/api/travels/<int:tid>', methods=['PUT'])
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
            WHERE tl.travel_id = %s AND l.deleted_at IS NULL
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
        if cur.rowcount == 0:
            db.rollback()
            return jsonify({'error': 'Not found'}), 404
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


@bp.route('/api/travels/<int:tid>', methods=['DELETE'])
def delete_travel(tid):
    """Soft delete (deleted_at = NOW). Hard delete tylko z ?hard=1
    — wtedy razem z powiązaniami w travel_locations / travel_participants."""
    if request.args.get('hard') == '1':
        db = get_db()
        with db.cursor() as cur:
            cur.execute("DELETE FROM travel_participants WHERE travel_id=%s", (tid,))
            cur.execute("DELETE FROM travel_locations    WHERE travel_id=%s", (tid,))
            cur.execute("DELETE FROM travels             WHERE id=%s",        (tid,))
            if cur.rowcount == 0:
                db.rollback()
                return jsonify({'error': 'Not found'}), 404
            db.commit()
        return jsonify({'ok': True, 'hard': True})
    if execute_rowcount("UPDATE travels SET deleted_at = NOW() WHERE id=%s AND deleted_at IS NULL", (tid,)) == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'ok': True})


@bp.route('/api/travels/<int:tid>/restore', methods=['POST'])
def restore_travel(tid):
    if execute_rowcount("UPDATE travels SET deleted_at = NULL WHERE id=%s", (tid,)) == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'ok': True})


# ── Powiązania: miejsca w podróży, uczestnicy ──


def _visit_outside_range(start, end, arrival, departure):
    if not arrival and not departure:
        return None
    bad = (arrival   is not None and (arrival   < start or arrival   > end)) or \
          (departure is not None and (departure < start or departure > end))
    if not bad:
        return None
    return {'travel_start': str(start), 'travel_end': str(end)}


def _visit_out_of_travel_range(tid, arrival, departure):
    """Zwraca dict z zakresem podróży jeśli daty wizyty są poza zakresem; inaczej None."""
    if not arrival and not departure:
        return None
    travel = query("SELECT start_date, end_date FROM travels WHERE id=%s", (tid,), one=True)
    if not travel:
        return None
    return _visit_outside_range(travel['start_date'], travel['end_date'], arrival, departure)


def _out_of_range_response(info):
    return jsonify({
        'error': f'Daty wizyty są poza zakresem podróży ({info["travel_start"]} – {info["travel_end"]})',
        'out_of_range': True,
        'travel_start': info['travel_start'],
        'travel_end':   info['travel_end'],
    }), 409


@bp.route('/api/travels/<int:tid>/locations', methods=['POST'])
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


@bp.route('/api/travels/<int:tid>/locations/<int:tlid>', methods=['DELETE'])
def remove_location_from_travel(tid, tlid):
    execute("DELETE FROM travel_locations WHERE id=%s AND travel_id=%s", (tlid, tid))
    return jsonify({'ok': True})


@bp.route('/api/travels/<int:tid>/locations/<int:tlid>', methods=['PUT'])
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


@bp.route('/api/travels/<int:tid>/participants', methods=['POST'])
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


@bp.route('/api/travels/<int:tid>/participants/<int:pid>', methods=['DELETE'])
def remove_participant_from_travel(tid, pid):
    execute(
        "DELETE FROM travel_participants WHERE travel_id=%s AND person_id=%s",
        (tid, pid),
    )
    return jsonify({'ok': True})
