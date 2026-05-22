"""Country-history aggregations for the stats dashboard."""

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


def _country_history(year=None):
    period_start, period_end = _period_bounds(year)
    rows = [dict(r) for r in query("""
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
        })
        country['periods'].append({
            'travel_id': row['travel_id'],
            'start': start,
            'end': end,
        })

    today = date.today()
    items = []
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
            day_count = (end - start).days + 1
            days.update(date.fromordinal(start.toordinal() + i) for i in range(day_count))

            if period_start and period_end and start <= period_end and end >= period_start:
                clipped_start = max(start, period_start)
                clipped_end = min(end, period_end)
                clipped_days = (clipped_end - clipped_start).days + 1
                period_days.update(date.fromordinal(clipped_start.toordinal() + i) for i in range(clipped_days))
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
    return {
        'summary': {
            'countries': len(items),
            'active_countries': len(scoped_items),
            'returning_countries': len(returning),
            'single_visit_countries': len(single_visit),
            'avg_days_per_country': round(
                sum(c[days_key] for c in summary_source) / len(summary_source),
                1,
            ) if summary_source else 0,
        },
        'countries': scoped_items[:50],
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
