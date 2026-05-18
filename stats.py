"""Blueprint /api/stats: agregaty i raporty (filtracja po roku, YoY, hall of fame, heatmap)."""

from datetime import date

from flask import Blueprint, request

from core import etag_json, query


bp = Blueprint('stats', __name__)


def _period_stats(year=None):
    """Statystyki za wybrany rok (year=None oznacza all-time).
    Wszystkie agregaty pomijają miękko-skasowane podróże (deleted_at IS NOT NULL)."""
    if year:
        where_main = "WHERE deleted_at IS NULL AND EXTRACT(YEAR FROM start_date) = %s"
        and_main   = "AND deleted_at IS NULL AND EXTRACT(YEAR FROM start_date) = %s"
        join_t_year = "AND t.deleted_at IS NULL AND EXTRACT(YEAR FROM t.start_date) = %s"
        params = (year,)
    else:
        where_main = "WHERE deleted_at IS NULL"
        and_main   = "AND deleted_at IS NULL"
        join_t_year = "AND t.deleted_at IS NULL"
        params = ()

    travels = [dict(r) for r in query(f"SELECT * FROM travels {where_main}", params)]

    countries_count = query(f"""
        SELECT COUNT(DISTINCT c.id) AS cnt FROM locations l
        JOIN countries c ON l.country_id = c.id
        JOIN travel_locations tl ON tl.location_id = l.id
        JOIN travels t ON t.id = tl.travel_id
        WHERE l.deleted_at IS NULL {join_t_year}
    """, params, one=True)['cnt']

    total_days = 0
    amount_by_currency = {}
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
            total_days += (e - s).days + 1
        except Exception:
            pass
        amount = float(t.get('amount') or 0)
        if amount > 0:
            cur = (t.get('currency') or 'PLN').upper()
            amount_by_currency[cur] = amount_by_currency.get(cur, 0) + amount
        if t.get('rating'):
            ratings.append(t['rating'])
        flights += int(t.get('number_of_flights') or 0)
        if t.get('has_photo_album'):
            albums += 1
        purpose = t.get('purpose') or 'Inne'
        purposes[purpose] = purposes.get(purpose, 0) + 1

    participation = query(f"""
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
          {('WHERE ' + where_main[6:]) if where_main else ''}
          GROUP BY t.id
        ) sub
    """, params, one=True)

    top_expensive = [dict(r) for r in query(f"""
        SELECT name, amount, currency, start_date, end_date,
               (end_date - start_date + 1) AS days
        FROM travels WHERE amount > 0 {and_main}
        ORDER BY amount DESC LIMIT 10
    """, params)]
    for t in top_expensive:
        for k in ('start_date', 'end_date'):
            if t.get(k):
                t[k] = str(t[k])

    top_countries = [dict(r) for r in query(f"""
        SELECT c.name AS country, COUNT(DISTINCT tl.travel_id) AS visits
        FROM travel_locations tl
        JOIN locations l ON l.id = tl.location_id
        JOIN countries c ON c.id = l.country_id
        JOIN travels t ON t.id = tl.travel_id
        WHERE l.deleted_at IS NULL {join_t_year}
        GROUP BY c.name ORDER BY visits DESC LIMIT 5
    """, params)]

    # days_spent: COUNT(DISTINCT day) zamiast SUM długości pobytów —
    # gdy parent (np. Lizbona) i jej dzieci (Alfama, Belém) mają nakładające
    # się daty, każdy dzień kalendarzowy liczy się tylko raz.
    # latitude/longitude z parent location (l) — używane przez mini-mapę DASH7.
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
        CROSS JOIN LATERAL generate_series(tl.arrival_date::timestamp,
                                            tl.departure_date::timestamp,
                                            interval '1 day') d
        WHERE LOWER(lt.name) IN ('miasto', 'wyspa')
          AND l.deleted_at IS NULL AND child.deleted_at IS NULL {join_t_year}
        GROUP BY l.id, l.name, c.name, lt.name, l.latitude, l.longitude
        ORDER BY visit_count DESC, days_spent DESC LIMIT 10
    """, params)]
    for p in top_places:
        if p.get('lat') is not None:
            p['lat'] = float(p['lat'])
        if p.get('lon') is not None:
            p['lon'] = float(p['lon'])

    by_month = [dict(r) for r in query(f"""
        SELECT EXTRACT(MONTH FROM start_date)::int AS month, COUNT(*) AS count
        FROM travels {where_main}
        GROUP BY month ORDER BY count DESC
    """, params)]

    avg_row = query(f"SELECT ROUND(AVG(end_date - start_date + 1), 1) AS avg_days FROM travels {where_main}", params, one=True)
    avg_trip_days = float(avg_row['avg_days'] or 0)

    cost_per_day = [dict(r) for r in query(f"""
        SELECT name, amount, currency,
               (end_date - start_date + 1) AS days,
               ROUND(amount / (end_date - start_date + 1), 0) AS cost_per_day
        FROM travels WHERE amount > 0 {and_main}
        ORDER BY cost_per_day DESC LIMIT 5
    """, params)]

    progress = query(f"""
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN is_description_complete THEN 1 ELSE 0 END) AS described,
               SUM(CASE WHEN has_photo_album THEN 1 ELSE 0 END) AS with_album
        FROM travels {where_main}
    """, params, one=True)

    return {
        'total_trips': len(travels),
        'total_days': total_days,
        'countries': countries_count,
        'flights': flights,
        'albums': albums,
        'avg_rating': round(sum(ratings) / len(ratings), 1) if ratings else 0,
        'avg_trip_days': avg_trip_days,
        'amount_by_currency': {cur: round(amt, 2) for cur, amt in sorted(amount_by_currency.items(), key=lambda x: -x[1])},
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
        'by_month':      by_month,
        'cost_per_day':  cost_per_day,
        'progress': {
            'total':      int(progress['total'] or 0),
            'described':  int(progress['described'] or 0),
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
        'days_in':    int(r['days_in']),
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
               COUNT(*) AS days
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

    # YoY: tylko gdy konkretny rok wybrany
    prev_period = None
    if year:
        prev = _period_stats(year - 1)
        prev_period = {
            'year':         year - 1,
            'total_trips':  prev['total_trips'],
            'total_days':   prev['total_days'],
            'countries':    prev['countries'],
            'flights':      prev['flights'],
            'albums':       prev['albums'],
            'avg_rating':   prev['avg_rating'],
            'avg_trip_days': prev['avg_trip_days'],
            'amount_by_currency': prev['amount_by_currency'],
            'progress_described': prev['progress']['described'],
        }

    # All-time / niefiltrowalne
    locations_count = query("SELECT COUNT(*) AS cnt FROM locations WHERE deleted_at IS NULL", one=True)['cnt']

    by_year = [dict(r) for r in query("""
        SELECT EXTRACT(YEAR FROM start_date)::int AS year, COUNT(*) AS count
        FROM travels WHERE deleted_at IS NULL GROUP BY year ORDER BY year
    """)]

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
        'longest':      {'id': hof_longest['id'],      'name': hof_longest['name'],      'value': int(hof_longest['days'])}           if hof_longest      else None,
        'priciest':     {'id': hof_priciest['id'],     'name': hof_priciest['name'],     'value': float(hof_priciest['amount']),     'currency': hof_priciest['currency']} if hof_priciest     else None,
        'best_rated':   {'id': hof_best_rated['id'],   'name': hof_best_rated['name'],   'value': float(hof_best_rated['rating'])}    if hof_best_rated   else None,
        'most_places':  {'id': hof_most_places['id'],  'name': hof_most_places['name'],  'value': int(hof_most_places['loc_count'])}  if hof_most_places  else None,
        'most_flights': {'id': hof_most_flights['id'], 'name': hof_most_flights['name'], 'value': int(hof_most_flights['number_of_flights'])} if hof_most_flights else None,
    }

    return etag_json({
        **period,
        'locations':     locations_count,
        'by_year':       by_year,
        'hall_of_fame':  hall_of_fame,
        'year':          year,
        'prev_period':   prev_period,
        'current_trip':  _current_trip(),
        'streak_months': _streak_months(),
        'heatmap':       _heatmap_data(),
    })
