"""Hall of Fame aggregations for the stats dashboard."""

from core import query


def _hof_row(sql):
    r = query(sql, one=True)
    return dict(r) if r else None


def _hall_of_fame():
    hof_longest = _hof_row("""
        SELECT id, name, (end_date - start_date + 1) AS days
        FROM travels WHERE deleted_at IS NULL ORDER BY days DESC LIMIT 1
    """)
    hof_priciest = _hof_row("""
        SELECT id, name, amount, currency
        FROM travels WHERE deleted_at IS NULL AND amount > 0 ORDER BY amount DESC LIMIT 1
    """)
    hof_best_rated = _hof_row("""
        SELECT id, name, rating
        FROM travels WHERE deleted_at IS NULL AND rating IS NOT NULL ORDER BY rating DESC, start_date DESC LIMIT 1
    """)
    hof_most_places = _hof_row("""
        SELECT t.id, t.name, COUNT(tl.id) AS loc_count
        FROM travels t JOIN travel_locations tl ON tl.travel_id = t.id
        WHERE t.deleted_at IS NULL
        GROUP BY t.id, t.name ORDER BY loc_count DESC LIMIT 1
    """)
    hof_most_flights = _hof_row("""
        SELECT id, name, number_of_flights
        FROM travels WHERE deleted_at IS NULL AND number_of_flights > 0 ORDER BY number_of_flights DESC LIMIT 1
    """)
    hof_most_countries = _hof_row("""
        SELECT t.id, t.name, COUNT(DISTINCT c.id) AS country_count
        FROM travels t
        JOIN travel_locations tl ON tl.travel_id = t.id
        JOIN locations l ON l.id = tl.location_id
        JOIN countries c ON c.id = l.country_id
        WHERE t.deleted_at IS NULL AND l.deleted_at IS NULL
        GROUP BY t.id, t.name
        ORDER BY country_count DESC, t.start_date DESC LIMIT 1
    """)
    hof_top_country = _hof_row("""
        SELECT c.name, COUNT(DISTINCT tl.travel_id) AS visits,
               COUNT(DISTINCT d::date) AS days
        FROM travel_locations tl
        JOIN locations l ON l.id = tl.location_id
        JOIN countries c ON c.id = l.country_id
        JOIN travels t ON t.id = tl.travel_id
        LEFT JOIN LATERAL generate_series(tl.arrival_date::timestamp, tl.departure_date::timestamp, interval '1 day') d
          ON tl.arrival_date IS NOT NULL AND tl.departure_date IS NOT NULL
        WHERE t.deleted_at IS NULL AND l.deleted_at IS NULL
        GROUP BY c.name
        ORDER BY visits DESC, days DESC, c.name LIMIT 1
    """)
    hof_longest_gap = _hof_row("""
        WITH ordered AS (
            SELECT id, name, start_date,
                   LAG(end_date) OVER (ORDER BY start_date, end_date, id) AS prev_end_date
            FROM travels
            WHERE deleted_at IS NULL
        )
        SELECT id, name, GREATEST(start_date - prev_end_date - 1, 0) AS gap_days
        FROM ordered
        WHERE prev_end_date IS NOT NULL
        ORDER BY gap_days DESC, start_date DESC LIMIT 1
    """)
    hof_longest_streak = _hof_row("""
        WITH days AS (
            SELECT DISTINCT d::date AS day
            FROM travels t,
                 generate_series(t.start_date::timestamp, t.end_date::timestamp, interval '1 day') d
            WHERE t.deleted_at IS NULL
        ),
        numbered AS (
            SELECT day, day - (ROW_NUMBER() OVER (ORDER BY day))::int AS grp
            FROM days
        )
        SELECT MIN(day) AS start_date, MAX(day) AS end_date, COUNT(*) AS days
        FROM numbered
        GROUP BY grp
        ORDER BY days DESC, start_date DESC LIMIT 1
    """)
    hof_best_month = _hof_row("""
        SELECT EXTRACT(YEAR FROM d)::int AS year,
               EXTRACT(MONTH FROM d)::int AS month,
               COUNT(DISTINCT d::date) AS days
        FROM travels t,
             generate_series(t.start_date::timestamp, t.end_date::timestamp, interval '1 day') d
        WHERE t.deleted_at IS NULL
        GROUP BY year, month
        ORDER BY days DESC, year DESC, month DESC LIMIT 1
    """)

    return {
        'longest': {'id': hof_longest['id'], 'name': hof_longest['name'], 'value': int(hof_longest['days'])} if hof_longest else None,
        'priciest': {'id': hof_priciest['id'], 'name': hof_priciest['name'], 'value': float(hof_priciest['amount']), 'currency': hof_priciest['currency']} if hof_priciest else None,
        'best_rated': {'id': hof_best_rated['id'], 'name': hof_best_rated['name'], 'value': float(hof_best_rated['rating'])} if hof_best_rated else None,
        'most_places': {'id': hof_most_places['id'], 'name': hof_most_places['name'], 'value': int(hof_most_places['loc_count'])} if hof_most_places else None,
        'most_flights': {'id': hof_most_flights['id'], 'name': hof_most_flights['name'], 'value': int(hof_most_flights['number_of_flights'])} if hof_most_flights else None,
        'most_countries': {'id': hof_most_countries['id'], 'name': hof_most_countries['name'], 'value': int(hof_most_countries['country_count'])} if hof_most_countries else None,
        'top_country': {'name': hof_top_country['name'], 'visits': int(hof_top_country['visits']), 'days': int(hof_top_country['days'] or 0)} if hof_top_country else None,
        'longest_gap': {'id': hof_longest_gap['id'], 'name': hof_longest_gap['name'], 'value': int(hof_longest_gap['gap_days'])} if hof_longest_gap else None,
        'longest_streak': {
            'start_date': str(hof_longest_streak['start_date']),
            'end_date': str(hof_longest_streak['end_date']),
            'value': int(hof_longest_streak['days']),
        } if hof_longest_streak else None,
        'best_month': {
            'year': int(hof_best_month['year']),
            'month': int(hof_best_month['month']),
            'value': int(hof_best_month['days']),
        } if hof_best_month else None,
    }
