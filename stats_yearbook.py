"""Yearbook aggregations for the stats dashboard."""

from datetime import date

from core import query


def _date_str(value):
    return str(value) if value else None


def _number_or_none(value):
    if value is None:
        return None
    return float(value)


def _travel_item(row):
    return {
        'id': row['id'],
        'name': row['name'] or '(bez nazwy)',
        'start_date': _date_str(row.get('start_date')),
        'end_date': _date_str(row.get('end_date')),
        'purpose': row.get('purpose') or '',
        'rating': _number_or_none(row.get('rating')),
        'amount': _number_or_none(row.get('amount')),
        'currency': row.get('currency') or 'PLN',
        'days': int(row.get('days') or 0),
    }


def _yearbook(limit_years=12, trips_per_year=6):
    summary_rows = [dict(r) for r in query("""
        WITH year_trips AS (
            SELECT EXTRACT(YEAR FROM d)::int AS year,
                   t.id AS travel_id,
                   COUNT(DISTINCT d::date) AS days
            FROM travels t
            CROSS JOIN LATERAL generate_series(t.start_date::timestamp, t.end_date::timestamp, interval '1 day') d
            WHERE t.deleted_at IS NULL
            GROUP BY year, t.id
        ),
        year_summary AS (
            SELECT year,
                   COUNT(DISTINCT travel_id) AS trips,
                   SUM(days) AS days
            FROM year_trips
            GROUP BY year
        ),
        year_countries AS (
            SELECT yt.year,
                   COUNT(DISTINCT c.id) AS countries
            FROM year_trips yt
            JOIN travels t ON t.id = yt.travel_id
            LEFT JOIN travel_locations tl ON tl.travel_id = t.id
                AND COALESCE(tl.arrival_date, t.start_date) <= make_date(yt.year, 12, 31)
                AND COALESCE(tl.departure_date, t.end_date) >= make_date(yt.year, 1, 1)
            LEFT JOIN locations l ON l.id = tl.location_id AND l.deleted_at IS NULL
            LEFT JOIN countries c ON c.id = l.country_id
            GROUP BY yt.year
        )
        SELECT ys.year,
               ys.trips,
               ys.days,
               COALESCE(yc.countries, 0) AS countries
        FROM year_summary ys
        LEFT JOIN year_countries yc ON yc.year = ys.year
        ORDER BY ys.year DESC
        LIMIT %s
    """, (limit_years,))]

    chapters = {}
    for row in summary_rows:
        year = int(row['year'])
        chapters[year] = {
            'year': year,
            'trips': int(row['trips'] or 0),
            'days': int(row['days'] or 0),
            'countries': int(row['countries'] or 0),
            'top_month': None,
            'new_countries': [],
            'returning_countries': [],
            'highlights': {},
            'trips_list': [],
        }
    if not chapters:
        return []

    allowed_years = set(chapters)

    trip_rows = [dict(r) for r in query("""
        WITH year_trips AS (
            SELECT EXTRACT(YEAR FROM d)::int AS year,
                   t.id AS travel_id,
                   COUNT(DISTINCT d::date) AS days
            FROM travels t
            CROSS JOIN LATERAL generate_series(t.start_date::timestamp, t.end_date::timestamp, interval '1 day') d
            WHERE t.deleted_at IS NULL
            GROUP BY year, t.id
        )
        SELECT yt.year,
               t.id,
               t.name,
               t.start_date,
               t.end_date,
               t.purpose,
               t.rating,
               t.amount,
               t.currency,
               yt.days
        FROM year_trips yt
        JOIN travels t ON t.id = yt.travel_id
        ORDER BY yt.year DESC, t.start_date, t.name
    """)]

    trips_by_year = {year: [] for year in allowed_years}
    for row in trip_rows:
        year = int(row['year'])
        if year not in allowed_years:
            continue
        trips_by_year[year].append(_travel_item(row))

    month_rows = [dict(r) for r in query("""
        SELECT EXTRACT(YEAR FROM d)::int AS year,
               EXTRACT(MONTH FROM d)::int AS month,
               COUNT(DISTINCT d::date) AS days
        FROM travels t
        CROSS JOIN LATERAL generate_series(t.start_date::timestamp, t.end_date::timestamp, interval '1 day') d
        WHERE t.deleted_at IS NULL
        GROUP BY year, month
        ORDER BY year DESC, days DESC, month
    """)]
    for row in month_rows:
        year = int(row['year'])
        if year in chapters and chapters[year]['top_month'] is None:
            chapters[year]['top_month'] = {
                'month': int(row['month']),
                'days': int(row['days'] or 0),
            }

    country_rows = [dict(r) for r in query("""
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
        ),
        country_first AS (
            SELECT id, MIN(visit_start) AS first_visit
            FROM country_visits
            GROUP BY id
        ),
        active AS (
            SELECT y.year,
                   cv.id,
                   cv.name,
                   cf.first_visit,
                   COUNT(DISTINCT cv.travel_id) AS trips
            FROM (SELECT unnest(%s::int[]) AS year) y
            JOIN country_visits cv
              ON cv.visit_start <= make_date(y.year, 12, 31)
             AND cv.visit_end >= make_date(y.year, 1, 1)
            JOIN country_first cf ON cf.id = cv.id
            GROUP BY y.year, cv.id, cv.name, cf.first_visit
        )
        SELECT year, id, name, first_visit, trips
        FROM active
        ORDER BY year DESC, first_visit, name
    """, (list(allowed_years),))]

    for row in country_rows:
        year = int(row['year'])
        if year not in chapters:
            continue
        first_visit = row.get('first_visit')
        item = {
            'id': row['id'],
            'name': row['name'],
            'first_visit': _date_str(first_visit),
            'trips': int(row['trips'] or 0),
        }
        if isinstance(first_visit, date) and first_visit.year == year:
            chapters[year]['new_countries'].append(item)
        else:
            chapters[year]['returning_countries'].append(item)

    for year, trips in trips_by_year.items():
        if not trips:
            continue

        highlights = {}
        highlights['longest'] = max(trips, key=lambda t: (t['days'], t['rating'] or 0, t['name']))

        rated = [t for t in trips if t['rating'] is not None]
        if rated:
            highlights['best_rated'] = max(rated, key=lambda t: (t['rating'], t['days'], t['name']))

        paid = [t for t in trips if (t['amount'] or 0) > 0]
        if paid:
            highlights['priciest'] = max(paid, key=lambda t: (t['amount'] or 0, t['days'], t['name']))

        chapters[year]['highlights'] = highlights
        chapters[year]['trips_list'] = sorted(
            trips,
            key=lambda t: (t['days'], t['rating'] or 0, t['amount'] or 0, t['start_date'] or ''),
            reverse=True,
        )[:trips_per_year]
        chapters[year]['new_countries'] = chapters[year]['new_countries'][:6]
        chapters[year]['returning_countries'] = chapters[year]['returning_countries'][:6]

    return [chapters[year] for year in sorted(chapters, reverse=True)]
