"""Hall of Fame aggregations for the stats dashboard."""

from datetime import date

from core import query


def _date_or_none(value):
    if value is None:
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _inclusive_days(start, end):
    if not start or not end or end < start:
        return 0
    return (end - start).days + 1


def _travel_days(travel):
    return _inclusive_days(travel.get('start_date'), travel.get('end_date'))


def _travel_item(row):
    item = dict(row)
    item['start_date'] = _date_or_none(item.get('start_date'))
    item['end_date'] = _date_or_none(item.get('end_date'))
    item['amount'] = float(item.get('amount') or 0)
    item['rating'] = float(item['rating']) if item.get('rating') is not None else None
    item['number_of_flights'] = int(item.get('number_of_flights') or 0)
    return item


def _travel_sort_date(travel):
    return travel.get('start_date') or date.min


def _best(rows, key):
    return max(rows, key=key) if rows else None


def _longest_gap(travels):
    ordered = sorted(
        [t for t in travels if t.get('start_date') and t.get('end_date')],
        key=lambda t: (t['start_date'], t['end_date'], t['id']),
    )
    rows = []
    prev_end = None
    for travel in ordered:
        if prev_end is not None:
            rows.append({
                'id': travel['id'],
                'name': travel['name'],
                'start_date': travel['start_date'],
                'gap_days': max((travel['start_date'] - prev_end).days - 1, 0),
            })
            prev_end = max(prev_end, travel['end_date'])
        else:
            prev_end = travel['end_date']
    return _best(rows, lambda row: (row['gap_days'], row['start_date'], row['id']))


def _day_sets(travels):
    days = set()
    months = {}
    for travel in travels:
        start = travel.get('start_date')
        end = travel.get('end_date')
        day_count = _inclusive_days(start, end)
        for offset in range(day_count):
            day = date.fromordinal(start.toordinal() + offset)
            days.add(day)
            months.setdefault((day.year, day.month), set()).add(day)
    return days, months


def _longest_streak(days):
    if not days:
        return None
    groups = []
    start = None
    previous = None
    for day in sorted(days):
        if start is None:
            start = previous = day
            continue
        if (day - previous).days == 1:
            previous = day
            continue
        groups.append((start, previous, (previous - start).days + 1))
        start = previous = day
    groups.append((start, previous, (previous - start).days + 1))
    best = max(groups, key=lambda item: (item[2], item[0]))
    return {'start_date': best[0], 'end_date': best[1], 'days': best[2]}


def _best_month(months):
    if not months:
        return None
    (year, month), days = max(
        months.items(),
        key=lambda item: (len(item[1]), item[0][0], item[0][1]),
    )
    return {'year': year, 'month': month, 'days': len(days)}


def _location_aggregates(travels_by_id):
    rows = [dict(r) for r in query("""
        SELECT t.id AS travel_id,
               COUNT(DISTINCT tl.location_id) AS loc_count,
               COUNT(DISTINCT c.id) AS country_count
        FROM travels t
        JOIN travel_locations tl ON tl.travel_id = t.id
        JOIN locations l ON l.id = tl.location_id
        JOIN countries c ON c.id = l.country_id
        WHERE t.deleted_at IS NULL AND l.deleted_at IS NULL
        GROUP BY t.id
    """)]
    aggregates = {}
    for row in rows:
        travel = travels_by_id.get(row['travel_id'])
        if not travel:
            continue
        aggregates[row['travel_id']] = {
            **travel,
            'loc_count': int(row.get('loc_count') or 0),
            'country_count': int(row.get('country_count') or 0),
        }
    return aggregates


def _top_country():
    rows = [dict(r) for r in query("""
        SELECT c.name,
               tl.travel_id,
               tl.arrival_date,
               tl.departure_date
        FROM travel_locations tl
        JOIN locations l ON l.id = tl.location_id
        JOIN countries c ON c.id = l.country_id
        JOIN travels t ON t.id = tl.travel_id
        WHERE t.deleted_at IS NULL AND l.deleted_at IS NULL
    """)]
    countries = {}
    for row in rows:
        item = countries.setdefault(row['name'], {'name': row['name'], 'visits': set(), 'days': set()})
        item['visits'].add(row['travel_id'])
        start = _date_or_none(row.get('arrival_date'))
        end = _date_or_none(row.get('departure_date'))
        day_count = _inclusive_days(start, end)
        for offset in range(day_count):
            item['days'].add(date.fromordinal(start.toordinal() + offset))
    if not countries:
        return None
    return sorted(
        countries.values(),
        key=lambda item: (-len(item['visits']), -len(item['days']), item['name']),
    )[0]


def _hall_of_fame():
    travels = [_travel_item(r) for r in query("""
        SELECT id, name, start_date, end_date, amount, currency, rating, number_of_flights
        FROM travels
        WHERE deleted_at IS NULL
    """)]
    travels_by_id = {travel['id']: travel for travel in travels}
    location_aggregates = _location_aggregates(travels_by_id)
    top_country = _top_country()
    travel_days, month_days = _day_sets(travels)

    longest = _best(travels, lambda t: (_travel_days(t), _travel_sort_date(t), t['id']))
    priciest = _best(
        [t for t in travels if t['amount'] > 0],
        lambda t: (t['amount'], _travel_sort_date(t), t['id']),
    )
    best_rated = _best(
        [t for t in travels if t['rating'] is not None],
        lambda t: (t['rating'], _travel_sort_date(t), t['id']),
    )
    most_places = _best(
        list(location_aggregates.values()),
        lambda t: (t['loc_count'], _travel_sort_date(t), t['id']),
    )
    most_flights = _best(
        [t for t in travels if t['number_of_flights'] > 0],
        lambda t: (t['number_of_flights'], _travel_sort_date(t), t['id']),
    )
    most_countries = _best(
        list(location_aggregates.values()),
        lambda t: (t['country_count'], _travel_sort_date(t), t['id']),
    )
    longest_gap = _longest_gap(travels)
    longest_streak = _longest_streak(travel_days)
    best_month = _best_month(month_days)

    return {
        'longest': {'id': longest['id'], 'name': longest['name'], 'value': _travel_days(longest)} if longest else None,
        'priciest': {'id': priciest['id'], 'name': priciest['name'], 'value': priciest['amount'], 'currency': priciest['currency']} if priciest else None,
        'best_rated': {'id': best_rated['id'], 'name': best_rated['name'], 'value': best_rated['rating']} if best_rated else None,
        'most_places': {'id': most_places['id'], 'name': most_places['name'], 'value': most_places['loc_count']} if most_places else None,
        'most_flights': {'id': most_flights['id'], 'name': most_flights['name'], 'value': most_flights['number_of_flights']} if most_flights else None,
        'most_countries': {'id': most_countries['id'], 'name': most_countries['name'], 'value': most_countries['country_count']} if most_countries else None,
        'top_country': {'name': top_country['name'], 'visits': len(top_country['visits']), 'days': len(top_country['days'])} if top_country else None,
        'longest_gap': {'id': longest_gap['id'], 'name': longest_gap['name'], 'value': longest_gap['gap_days']} if longest_gap else None,
        'longest_streak': {
            'start_date': str(longest_streak['start_date']),
            'end_date': str(longest_streak['end_date']),
            'value': longest_streak['days'],
        } if longest_streak else None,
        'best_month': {
            'year': best_month['year'],
            'month': best_month['month'],
            'value': best_month['days'],
        } if best_month else None,
    }
