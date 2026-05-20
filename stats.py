"""Blueprint /api/stats: aggregate travel analytics for the dashboard."""

from datetime import date

from flask import Blueprint, request

from core import etag_json, query


bp = Blueprint('stats', __name__)


def _period_bounds(year):
    if not year:
        return None, None
    return date(year, 1, 1), date(year, 12, 31)


def _travel_period_clause(year, alias=''):
    prefix = f'{alias}.' if alias else ''
    if not year:
        return f'{prefix}deleted_at IS NULL', ()
    start, end = _period_bounds(year)
    return (
        f'{prefix}deleted_at IS NULL AND {prefix}start_date <= %s AND {prefix}end_date >= %s',
        (end, start),
    )


def _clipped_trip_days(start_date, end_date, period_start=None, period_end=None):
    start = start_date if isinstance(start_date, date) else date.fromisoformat(str(start_date))
    end = end_date if isinstance(end_date, date) else date.fromisoformat(str(end_date))
    if period_start:
        start = max(start, period_start)
    if period_end:
        end = min(end, period_end)
    if end < start:
        return 0
    return (end - start).days + 1


def _day_series(base_start, base_end, year=None):
    if not year:
        return f"generate_series({base_start}::timestamp, {base_end}::timestamp, interval '1 day')"
    return (
        f"generate_series(GREATEST({base_start}, %s::date)::timestamp, "
        f"LEAST({base_end}, %s::date)::timestamp, interval '1 day')"
    )


def _series_params(year):
    if not year:
        return ()
    return _period_bounds(year)


def _data_quality(year=None):
    main_clause, main_params = _travel_period_clause(year, 't')
    rows = [dict(r) for r in query(f"""
        SELECT t.*,
               COUNT(tl.id) AS loc_count
        FROM travels t
        LEFT JOIN travel_locations tl ON tl.travel_id = t.id
        WHERE {main_clause}
        GROUP BY t.id
        ORDER BY t.start_date DESC
    """, main_params)]

    checks = [
        ('missing_cost', 'brak kosztu', lambda t: float(t.get('amount') or 0) <= 0),
        ('missing_rating', 'brak oceny', lambda t: t.get('rating') is None),
        ('missing_locations', 'brak miejsc', lambda t: int(t.get('loc_count') or 0) == 0),
        ('missing_reflections', 'brak wspomnień', lambda t: not (t.get('reflections') or '').strip()),
        ('missing_album', 'brak albumu', lambda t: not t.get('has_photo_album')),
        ('incomplete_description', 'opis niekompletny', lambda t: not t.get('is_description_complete')),
    ]
    counts = {key: 0 for key, _, _ in checks}
    needs_attention = []

    for t in rows:
        missing = []
        for key, label, predicate in checks:
            if predicate(t):
                counts[key] += 1
                missing.append(label)
        if missing:
            needs_attention.append({
                'id': t['id'],
                'name': t.get('name') or '(bez nazwy)',
                'start_date': str(t['start_date']) if t.get('start_date') else None,
                'missing': missing,
                'missing_count': len(missing),
            })

    needs_attention.sort(key=lambda t: (t['missing_count'], t['start_date'] or ''), reverse=True)
    return {
        'total': len(rows),
        'counts': counts,
        'needs_attention': needs_attention[:8],
    }


def _country_milestones(year=None):
    if not year:
        return {'new': [], 'returning': []}

    period_start, period_end = _period_bounds(year)
    rows = [dict(r) for r in query("""
        WITH country_visits AS (
            SELECT c.id,
                   c.name,
                   t.id AS travel_id,
                   COALESCE(tl.arrival_date, t.start_date) AS visit_start,
                   COALESCE(tl.departure_date, t.end_date) AS visit_end
            FROM travel_locations tl
            JOIN locations l ON l.id = tl.location_id
            JOIN countries c ON c.id = l.country_id
            JOIN travels t ON t.id = tl.travel_id
            WHERE t.deleted_at IS NULL AND l.deleted_at IS NULL
        )
        SELECT id,
               name,
               MIN(visit_start) AS first_visit,
               COUNT(DISTINCT travel_id) FILTER (
                   WHERE visit_start <= %s AND visit_end >= %s
               ) AS period_trips
        FROM country_visits
        GROUP BY id, name
        HAVING COUNT(DISTINCT travel_id) FILTER (
            WHERE visit_start <= %s AND visit_end >= %s
        ) > 0
        ORDER BY first_visit, name
    """, (period_end, period_start, period_end, period_start))]

    new_countries = []
    returning = []
    for r in rows:
        first_visit = r['first_visit']
        item = {
            'id': r['id'],
            'name': r['name'],
            'first_visit': str(first_visit) if first_visit else None,
            'trips': int(r['period_trips'] or 0),
        }
        if first_visit and period_start <= first_visit <= period_end:
            new_countries.append(item)
        elif first_visit and first_visit < period_start:
            returning.append(item)

    return {
        'new': new_countries,
        'returning': returning,
    }


def _period_stats(year=None):
    """Stats for all time or for activity overlapping the selected calendar year."""
    period_start, period_end = _period_bounds(year)
    main_clause, main_params = _travel_period_clause(year)
    t_clause, t_params = _travel_period_clause(year, 't')

    travels = [dict(r) for r in query(f"SELECT * FROM travels WHERE {main_clause}", main_params)]

    countries_count = query(f"""
        SELECT COUNT(DISTINCT c.id) AS cnt
        FROM travel_locations tl
        JOIN locations l ON l.id = tl.location_id
        JOIN countries c ON c.id = l.country_id
        JOIN travels t ON t.id = tl.travel_id
        WHERE l.deleted_at IS NULL AND {t_clause}
    """, t_params, one=True)['cnt']

    visited_locations_count = query(f"""
        SELECT COUNT(DISTINCT l.id) AS cnt
        FROM travel_locations tl
        JOIN locations l ON l.id = tl.location_id
        JOIN travels t ON t.id = tl.travel_id
        WHERE l.deleted_at IS NULL AND {t_clause}
    """, t_params, one=True)['cnt']

    total_days_set = set()
    trip_days = []
    amount_by_currency = {}
    ratings = []
    flights = 0
    albums = 0
    purposes = {}

    for t in travels:
        try:
            start = t['start_date'] if isinstance(t['start_date'], date) else date.fromisoformat(str(t['start_date']))
            end = t['end_date'] if isinstance(t['end_date'], date) else date.fromisoformat(str(t['end_date']))
            if period_start:
                start = max(start, period_start)
            if period_end:
                end = min(end, period_end)
            if end >= start:
                days = (end - start).days + 1
                trip_days.append(days)
                total_days_set.update(date.fromordinal(start.toordinal() + i) for i in range(days))
        except Exception:
            pass

        amount = float(t.get('amount') or 0)
        if amount > 0:
            cur = (t.get('currency') or 'PLN').upper()
            amount_by_currency[cur] = amount_by_currency.get(cur, 0) + amount
        if t.get('rating'):
            ratings.append(float(t['rating']))
        flights += int(t.get('number_of_flights') or 0)
        if t.get('has_photo_album'):
            albums += 1
        purpose = t.get('purpose') or 'Inne'
        purposes[purpose] = purposes.get(purpose, 0) + 1

    participant_day_series = _day_series('t.start_date', 't.end_date', year)
    participant_params = _series_params(year) + t_params
    participants = [dict(r) for r in query(f"""
        SELECT p.id, p.name, rt.name AS relation_type,
               COUNT(DISTINCT t.id) AS trips,
               COUNT(DISTINCT d::date) AS days
        FROM persons p
        JOIN travel_participants tp ON tp.person_id = p.id
        JOIN travels t ON t.id = tp.travel_id
        LEFT JOIN relation_types rt ON p.relation_type_id = rt.id
        CROSS JOIN LATERAL {participant_day_series} d
        WHERE {t_clause}
        GROUP BY p.id, p.name, rt.name
        ORDER BY trips DESC, days DESC, p.name
        LIMIT 10
    """, participant_params)]
    for p in participants:
        p['trips'] = int(p['trips'])
        p['days'] = int(p['days'])

    top_expensive = [dict(r) for r in query(f"""
        SELECT name, amount, currency, start_date, end_date,
               (end_date - start_date + 1) AS days
        FROM travels
        WHERE amount > 0 AND {main_clause}
        ORDER BY amount DESC LIMIT 10
    """, main_params)]
    for t in top_expensive:
        for k in ('start_date', 'end_date'):
            if t.get(k):
                t[k] = str(t[k])

    visit_day_series = _day_series('tl.arrival_date', 'tl.departure_date', year)
    visit_series_params = _series_params(year) + t_params

    top_countries = [dict(r) for r in query(f"""
        SELECT c.name AS country,
               COUNT(DISTINCT tl.travel_id) AS visits,
               COUNT(DISTINCT d::date) AS days_spent
        FROM travel_locations tl
        JOIN locations l ON l.id = tl.location_id
        JOIN countries c ON c.id = l.country_id
        JOIN travels t ON t.id = tl.travel_id
        LEFT JOIN LATERAL {visit_day_series} d ON tl.arrival_date IS NOT NULL AND tl.departure_date IS NOT NULL
        WHERE l.deleted_at IS NULL AND {t_clause}
        GROUP BY c.name ORDER BY visits DESC, days_spent DESC LIMIT 5
    """, visit_series_params)]
    for c in top_countries:
        c['visits'] = int(c['visits'])
        c['days_spent'] = int(c['days_spent'] or 0)

    top_places = [dict(r) for r in query(f"""
        SELECT l.id, l.name AS location_name, c.name AS country,
               lt.name AS location_type,
               l.latitude AS lat, l.longitude AS lon,
               COUNT(DISTINCT tl.travel_id) AS visit_count,
               COUNT(DISTINCT d::date) AS days_spent
        FROM locations l
        JOIN countries c ON l.country_id = c.id
        JOIN location_types lt ON l.location_type_id = lt.id
        JOIN locations child ON (child.id = l.id OR child.parent_location_id = l.id)
        JOIN travel_locations tl ON tl.location_id = child.id
        JOIN travels t ON t.id = tl.travel_id
        LEFT JOIN LATERAL {visit_day_series} d ON tl.arrival_date IS NOT NULL AND tl.departure_date IS NOT NULL
        WHERE LOWER(lt.name) IN ('miasto', 'wyspa')
          AND l.deleted_at IS NULL AND child.deleted_at IS NULL AND {t_clause}
        GROUP BY l.id, l.name, c.name, lt.name, l.latitude, l.longitude
        ORDER BY visit_count DESC, days_spent DESC LIMIT 10
    """, visit_series_params)]
    for p in top_places:
        p['visit_count'] = int(p['visit_count'])
        p['days_spent'] = int(p['days_spent'] or 0)
        if p.get('lat') is not None:
            p['lat'] = float(p['lat'])
        if p.get('lon') is not None:
            p['lon'] = float(p['lon'])

    trip_day_series = _day_series('t.start_date', 't.end_date', year)
    trip_series_params = _series_params(year) + t_params
    by_month = [dict(r) for r in query(f"""
        SELECT EXTRACT(MONTH FROM d)::int AS month,
               COUNT(DISTINCT d::date) AS days,
               COUNT(DISTINCT t.id) AS count
        FROM travels t
        CROSS JOIN LATERAL {trip_day_series} d
        WHERE {t_clause}
        GROUP BY month ORDER BY month
    """, trip_series_params)]
    for m in by_month:
        m['days'] = int(m['days'])
        m['count'] = int(m['count'])

    avg_trip_days = round(sum(trip_days) / len(trip_days), 1) if trip_days else 0

    cost_per_day = [dict(r) for r in query(f"""
        SELECT name, amount, currency,
               (end_date - start_date + 1) AS days,
               ROUND(amount / (end_date - start_date + 1), 0) AS cost_per_day
        FROM travels
        WHERE amount > 0 AND {main_clause}
        ORDER BY cost_per_day DESC LIMIT 5
    """, main_params)]

    progress = query(f"""
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN is_description_complete THEN 1 ELSE 0 END) AS described,
               SUM(CASE WHEN has_photo_album THEN 1 ELSE 0 END) AS with_album
        FROM travels WHERE {main_clause}
    """, main_params, one=True)

    return {
        'total_trips': len(travels),
        'total_days': len(total_days_set),
        'countries': countries_count,
        'visited_locations': visited_locations_count,
        'flights': flights,
        'albums': albums,
        'avg_rating': round(sum(ratings) / len(ratings), 1) if ratings else 0,
        'avg_trip_days': avg_trip_days,
        'amount_by_currency': {
            cur: round(amt, 2)
            for cur, amt in sorted(amount_by_currency.items(), key=lambda x: -x[1])
        },
        'purposes': sorted(
            [{'name': k, 'count': v} for k, v in purposes.items()],
            key=lambda x: -x['count'],
        ),
        'participants': participants,
        'top_expensive': top_expensive,
        'top_countries': top_countries,
        'top_places': top_places,
        'by_month': by_month,
        'cost_per_day': cost_per_day,
        'progress': {
            'total': int(progress['total'] or 0),
            'described': int(progress['described'] or 0),
            'with_album': int(progress['with_album'] or 0),
        },
    }


def _current_trip():
    r = query("""
        SELECT id, name, start_date, end_date,
               (CURRENT_DATE - start_date + 1)::int AS days_in,
               (end_date - start_date + 1)::int    AS days_total
        FROM travels
        WHERE deleted_at IS NULL
          AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
        ORDER BY start_date DESC LIMIT 1
    """, one=True)
    if not r:
        return None
    return {
        'id': r['id'], 'name': r['name'],
        'start_date': str(r['start_date']),
        'end_date': str(r['end_date']),
        'days_in': int(r['days_in']),
        'days_total': int(r['days_total']),
    }


def _streak_months():
    rows = query("""
        SELECT DISTINCT
          EXTRACT(YEAR  FROM d)::int AS y,
          EXTRACT(MONTH FROM d)::int AS m
        FROM travels,
             generate_series(start_date::timestamp, end_date::timestamp, interval '1 day') d
        WHERE deleted_at IS NULL
    """)
    months = {(r['y'], r['m']) for r in rows}
    today = date.today()
    y, m, streak = today.year, today.month, 0
    while (y, m) in months:
        streak += 1
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return streak


def _heatmap_data():
    rows = query("""
        SELECT EXTRACT(YEAR  FROM d)::int AS year,
               EXTRACT(MONTH FROM d)::int AS month,
               COUNT(DISTINCT d::date) AS days
        FROM travels,
             generate_series(start_date::timestamp, end_date::timestamp, interval '1 day') d
        WHERE deleted_at IS NULL
        GROUP BY year, month
        ORDER BY year, month
    """)
    return [{'year': r['year'], 'month': r['month'], 'days': int(r['days'])} for r in rows]


@bp.route('/api/stats')
def get_stats():
    raw_year = request.args.get('year')
    year = int(raw_year) if raw_year and raw_year.isdigit() else None

    period = _period_stats(year)

    prev_period = None
    if year:
        prev = _period_stats(year - 1)
        prev_period = {
            'year': year - 1,
            'total_trips': prev['total_trips'],
            'total_days': prev['total_days'],
            'countries': prev['countries'],
            'visited_locations': prev['visited_locations'],
            'flights': prev['flights'],
            'albums': prev['albums'],
            'avg_rating': prev['avg_rating'],
            'avg_trip_days': prev['avg_trip_days'],
            'amount_by_currency': prev['amount_by_currency'],
            'progress_described': prev['progress']['described'],
        }

    locations_count = query("SELECT COUNT(*) AS cnt FROM locations WHERE deleted_at IS NULL", one=True)['cnt']

    by_year = [dict(r) for r in query("""
        SELECT EXTRACT(YEAR FROM d)::int AS year,
               COUNT(DISTINCT t.id) AS count,
               COUNT(DISTINCT d::date) AS days
        FROM travels t,
             generate_series(t.start_date::timestamp, t.end_date::timestamp, interval '1 day') d
        WHERE t.deleted_at IS NULL
        GROUP BY year ORDER BY year
    """)]
    for y in by_year:
        y['count'] = int(y['count'])
        y['days'] = int(y['days'])

    def hof_row(sql):
        r = query(sql, one=True)
        return dict(r) if r else None

    hof_longest = hof_row("""
        SELECT id, name, (end_date - start_date + 1) AS days
        FROM travels WHERE deleted_at IS NULL ORDER BY days DESC LIMIT 1
    """)
    hof_priciest = hof_row("""
        SELECT id, name, amount, currency
        FROM travels WHERE deleted_at IS NULL AND amount > 0 ORDER BY amount DESC LIMIT 1
    """)
    hof_best_rated = hof_row("""
        SELECT id, name, rating
        FROM travels WHERE deleted_at IS NULL AND rating IS NOT NULL ORDER BY rating DESC, start_date DESC LIMIT 1
    """)
    hof_most_places = hof_row("""
        SELECT t.id, t.name, COUNT(tl.id) AS loc_count
        FROM travels t JOIN travel_locations tl ON tl.travel_id = t.id
        WHERE t.deleted_at IS NULL
        GROUP BY t.id, t.name ORDER BY loc_count DESC LIMIT 1
    """)
    hof_most_flights = hof_row("""
        SELECT id, name, number_of_flights
        FROM travels WHERE deleted_at IS NULL AND number_of_flights > 0 ORDER BY number_of_flights DESC LIMIT 1
    """)

    hall_of_fame = {
        'longest': {'id': hof_longest['id'], 'name': hof_longest['name'], 'value': int(hof_longest['days'])} if hof_longest else None,
        'priciest': {'id': hof_priciest['id'], 'name': hof_priciest['name'], 'value': float(hof_priciest['amount']), 'currency': hof_priciest['currency']} if hof_priciest else None,
        'best_rated': {'id': hof_best_rated['id'], 'name': hof_best_rated['name'], 'value': float(hof_best_rated['rating'])} if hof_best_rated else None,
        'most_places': {'id': hof_most_places['id'], 'name': hof_most_places['name'], 'value': int(hof_most_places['loc_count'])} if hof_most_places else None,
        'most_flights': {'id': hof_most_flights['id'], 'name': hof_most_flights['name'], 'value': int(hof_most_flights['number_of_flights'])} if hof_most_flights else None,
    }

    return etag_json({
        **period,
        'locations': locations_count,
        'by_year': by_year,
        'hall_of_fame': hall_of_fame,
        'year': year,
        'prev_period': prev_period,
        'current_trip': _current_trip(),
        'streak_months': _streak_months(),
        'heatmap': _heatmap_data(),
        'data_quality': _data_quality(year),
        'country_milestones': _country_milestones(year),
    })
