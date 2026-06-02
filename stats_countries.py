"""Country-history aggregations for the stats dashboard."""

from collections import Counter, defaultdict
from datetime import date

from core import query
from stats_common import _period_bounds


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


def _date_or_none(value):
    if value is None:
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _inclusive_days(start, end):
    if not start or not end or end < start:
        return set()
    return {
        date.fromordinal(start.toordinal() + i)
        for i in range((end - start).days + 1)
    }


def _days_in_scope(start, end, period_start=None, period_end=None):
    if period_start and period_end:
        if start > period_end or end < period_start:
            return set()
        start = max(start, period_start)
        end = min(end, period_end)
    return _inclusive_days(start, end)


def _location_type_breakdown(locations, day_key='days_spent', visit_key='visit_count'):
    counts = Counter()
    days = Counter()
    visits = Counter()
    countries = defaultdict(set)

    for location in locations:
        location_type = location.get('location_type') or 'Inne'
        counts[location_type] += 1
        days[location_type] += int(location.get(day_key) or 0)
        visits[location_type] += int(location.get(visit_key) or 0)
        countries[location_type].add(location.get('country_id'))

    return [
        {
            'location_type': location_type,
            'locations': int(counts[location_type]),
            'countries': len(countries[location_type]),
            'visits': int(visits[location_type]),
            'days_spent': int(days[location_type]),
        }
        for location_type in sorted(
            counts,
            key=lambda name: (counts[name], days[name], visits[name], name),
            reverse=True,
        )
    ]


def _scoped_location_item(location, year):
    day_key = 'period_days' if year else 'days_spent'
    visit_key = 'period_visit_count' if year else 'visit_count'
    return {
        'id': location['id'],
        'name': location['name'],
        'country_id': location['country_id'],
        'country': location['country'],
        'location_type': location['location_type'],
        'visit_count': int(location.get(visit_key) or 0),
        'days_spent': int(location.get(day_key) or 0),
        'total_visit_count': int(location.get('visit_count') or 0),
        'total_days_spent': int(location.get('days_spent') or 0),
    }


def _build_location_metrics(country, period_start=None, period_end=None, year=None):
    location_items = []
    scoped_location_items = []

    for location in country['locations'].values():
        days = set()
        period_days = set()
        trips = set()
        period_trips = set()

        for period in location['periods']:
            start = period['start']
            end = period['end']
            trips.add(period['travel_id'])
            days.update(_days_in_scope(start, end))

            scoped_days = _days_in_scope(start, end, period_start, period_end) if year else _days_in_scope(start, end)
            if scoped_days:
                period_days.update(scoped_days)
                period_trips.add(period['travel_id'])

        if not days:
            continue

        item = {
            'id': location['id'],
            'name': location['name'],
            'country_id': country['id'],
            'country': country['name'],
            'location_type': location['location_type'],
            'visit_count': len(trips),
            'days_spent': len(days),
            'period_visit_count': len(period_trips) if year else len(trips),
            'period_days': len(period_days) if year else len(days),
        }
        location_items.append(item)
        if item['period_days'] > 0:
            scoped_location_items.append(item)

    location_items.sort(key=lambda item: (item['name'], item['id']))
    scoped_location_items.sort(key=lambda item: (item['name'], item['id']))
    return location_items, scoped_location_items


def _country_history(year=None):
    period_start, period_end = _period_bounds(year)
    rows = [dict(r) for r in query("""
        SELECT c.id,
               c.name,
               t.id AS travel_id,
               l.id AS location_id,
               l.name AS location_name,
               lt.name AS location_type,
               COALESCE(tl.arrival_date, t.start_date) AS visit_start,
               COALESCE(tl.departure_date, t.end_date) AS visit_end
        FROM travel_locations tl
        JOIN locations l ON l.id = tl.location_id
        JOIN location_types lt ON lt.id = l.location_type_id
        JOIN countries c ON c.id = l.country_id
        JOIN travels t ON t.id = tl.travel_id
        WHERE t.deleted_at IS NULL AND l.deleted_at IS NULL
    """)]

    countries = {}
    for row in rows:
        start = _date_or_none(row.get('visit_start'))
        end = _date_or_none(row.get('visit_end'))
        if not start or not end or end < start:
            continue
        country = countries.setdefault(row['id'], {
            'id': row['id'],
            'name': row['name'],
            'periods': [],
            'locations': {},
        })
        period = {
            'travel_id': row['travel_id'],
            'start': start,
            'end': end,
        }
        country['periods'].append(period)

        location_id = row.get('location_id')
        if location_id is not None:
            location = country['locations'].setdefault(location_id, {
                'id': location_id,
                'name': row.get('location_name') or '(bez nazwy)',
                'location_type': row.get('location_type') or 'Inne',
                'periods': [],
            })
            location['periods'].append(period)

    today = date.today()
    items = []
    scoped_locations = []
    for country in countries.values():
        periods = sorted(country['periods'], key=lambda p: (p['start'], p['end'], p['travel_id']))
        days = set()
        period_days = set()
        period_trips = set()
        longest_gap = 0
        longest_gap_start = None
        longest_gap_end = None
        prev_end = None

        for period in periods:
            start = period['start']
            end = period['end']
            days.update(_days_in_scope(start, end))

            if period_start and period_end and start <= period_end and end >= period_start:
                period_days.update(_days_in_scope(start, end, period_start, period_end))
                period_trips.add(period['travel_id'])

            if prev_end is not None:
                gap = max((start - prev_end).days - 1, 0)
                if gap > longest_gap:
                    longest_gap = gap
                    longest_gap_start = prev_end
                    longest_gap_end = start
                prev_end = max(prev_end, end)
            else:
                prev_end = end

        first_visit = periods[0]['start']
        last_visit = max(p['end'] for p in periods)
        years_visited = len({d.year for d in days})
        trips = len({p['travel_id'] for p in periods})
        active_trips = len(period_trips) if year else trips
        active_days = len(period_days) if year else len(days)
        days_since_last_visit = max((today - last_visit).days, 0)
        location_items, scoped_location_items = _build_location_metrics(
            country,
            period_start,
            period_end,
            year,
        )
        scoped_locations.extend(_scoped_location_item(location, year) for location in scoped_location_items)
        item = {
            'id': country['id'],
            'name': country['name'],
            'first_visit': str(first_visit),
            'last_visit': str(last_visit),
            'trips': trips,
            'days_spent': len(days),
            'years_visited': years_visited,
            'period_trips': active_trips,
            'period_days': active_days,
            'location_count': len(location_items),
            'period_location_count': len(scoped_location_items),
            'location_types': _location_type_breakdown(
                scoped_location_items,
                'period_days' if year else 'days_spent',
                'period_visit_count' if year else 'visit_count',
            ),
            'days_since_last_visit': days_since_last_visit,
            'longest_gap_days': longest_gap,
            'longest_gap_from': str(longest_gap_start) if longest_gap_start else None,
            'longest_gap_to': str(longest_gap_end) if longest_gap_end else None,
        }
        items.append(item)

    items.sort(key=lambda c: c['name'])
    scoped_items = items
    if year:
        scoped_items = [c for c in items if c['period_trips'] > 0]
    summary_source = scoped_items if year else items

    def top(rows, sort_key, limit=8):
        return sorted(rows, key=sort_key, reverse=True)[:limit]

    returning = [c for c in summary_source if c['trips'] > 1]
    single_visit = [c for c in summary_source if c['trips'] == 1]
    days_key = 'period_days' if year else 'days_spent'
    location_count_key = 'period_location_count' if year else 'location_count'
    top_location_types = _location_type_breakdown(scoped_locations)
    return {
        'summary': {
            'countries': len(items),
            'active_countries': len(scoped_items),
            'returning_countries': len(returning),
            'single_visit_countries': len(single_visit),
            'locations': sum(c[location_count_key] for c in summary_source),
            'location_types': len(top_location_types),
            'avg_days_per_country': round(
                sum(c[days_key] for c in summary_source) / len(summary_source),
                1,
            ) if summary_source else 0,
        },
        'countries': scoped_items[:50],
        'top_time_countries': top(summary_source, lambda c: (c[days_key], c[location_count_key], c['name'])),
        'top_location_countries': top(summary_source, lambda c: (c[location_count_key], c[days_key], c['name'])),
        'top_location_types': top_location_types[:8],
        'longest_places': top(
            scoped_locations,
            lambda c: (c['days_spent'], c['total_days_spent'], c['visit_count'], c['name']),
        ),
        'top_returns': top(returning, lambda c: (c['trips'], c['days_spent'], c['last_visit'])),
        'only_once': top(single_visit, lambda c: (c['last_visit'], c['name'])),
        'longest_absences': top(
            [c for c in summary_source if c['days_since_last_visit'] > 0],
            lambda c: (c['days_since_last_visit'], c['last_visit']),
        ),
        'most_regular': top(
            [c for c in summary_source if c['years_visited'] > 1 or c['trips'] > 1],
            lambda c: (c['years_visited'], c['trips'], c['days_spent']),
        ),
        'longest_gaps': top(
            [c for c in summary_source if c['longest_gap_days'] > 0],
            lambda c: (c['longest_gap_days'], c['last_visit']),
        ),
    }
