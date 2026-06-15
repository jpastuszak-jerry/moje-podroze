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


def _polish_count(count, one, few, many):
    count = int(count or 0)
    last_digit = count % 10
    last_two = count % 100
    if count == 1:
        word = one
    elif 2 <= last_digit <= 4 and not 12 <= last_two <= 14:
        word = few
    else:
        word = many
    return f'{count} {word}'


def _featured_trip(trips):
    if not trips:
        return None

    def score(trip):
        rating = float(trip.get('rating') or 0)
        days = int(trip.get('days') or 0)
        amount = float(trip.get('amount') or 0)
        return (
            rating * 8 + min(days, 21) + (1 if amount > 0 else 0),
            days,
            amount,
            trip.get('name') or '',
        )

    return max(trips, key=score)


def _yearbook_story(chapter):
    trips = int(chapter.get('trips') or 0)
    days = int(chapter.get('days') or 0)
    countries = int(chapter.get('countries') or 0)
    new_count = int(chapter.get('new_countries_count') or 0)
    returning_count = int(chapter.get('returning_countries_count') or 0)
    top_month = chapter.get('top_month') or {}

    if trips == 0:
        return {
            'title': 'Rok bez zapisanych podróży',
            'summary': 'W tym roku nie ma jeszcze podróży w bazie.',
        }

    if days >= 30:
        title = 'Rok w drodze'
    elif trips >= 8:
        title = 'Rok wielu wyjazdów'
    elif new_count >= 3:
        title = 'Rok odkryć'
    elif returning_count >= max(2, new_count + 1):
        title = 'Rok powrotów'
    elif countries >= 5:
        title = 'Rok szerokiej mapy'
    else:
        title = 'Rok spokojnych rozdziałów'

    parts = [
        (
            f"{_polish_count(trips, 'podróż', 'podróże', 'podróży')}, "
            f"{_polish_count(days, 'dzień', 'dni', 'dni')} w drodze "
            f"i {_polish_count(countries, 'kraj', 'kraje', 'krajów')}."
        )
    ]
    if new_count:
        parts.append(
            'Do kolekcji doszło '
            f"{_polish_count(new_count, 'nowy kraj', 'nowe kraje', 'nowych krajów')}."
        )
    if returning_count:
        parts.append(
            'Powroty zbudowały '
            f"{_polish_count(returning_count, 'znajomy kierunek', 'znajome kierunki', 'znajomych kierunków')}."
        )
    if top_month:
        parts.append(
            'Najmocniejszy miesiąc miał '
            f"{_polish_count(top_month.get('days'), 'dzień', 'dni', 'dni')} podróży."
        )

    return {'title': title, 'summary': ' '.join(parts)}


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
            'new_countries_count': 0,
            'returning_countries': [],
            'returning_countries_count': 0,
            'months': [],
            'highlights': {},
            'featured_trip': None,
            'story': None,
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
        if year in chapters:
            chapters[year]['months'].append({
                'month': int(row['month']),
                'days': int(row['days'] or 0),
            })

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

    for year, chapter in chapters.items():
        trips = trips_by_year.get(year, [])
        chapter['months'].sort(key=lambda month: month['month'])
        chapter['new_countries_count'] = len(chapter['new_countries'])
        chapter['returning_countries_count'] = len(chapter['returning_countries'])
        chapter['new_countries'] = chapter['new_countries'][:6]
        chapter['returning_countries'] = chapter['returning_countries'][:6]
        chapter['featured_trip'] = _featured_trip(trips)
        chapter['story'] = _yearbook_story(chapter)

    return [chapters[year] for year in sorted(chapters, reverse=True)]
