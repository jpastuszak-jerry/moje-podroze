"""Data-quality aggregations for the stats dashboard."""

from core import query
from stats_common import _travel_period_clause


def _data_quality(year=None, limit=8):
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
                'missing_keys': [key for key, _, predicate in checks if predicate(t)],
                'missing_count': len(missing),
            })

    needs_attention.sort(key=lambda t: (t['missing_count'], t['start_date'] or ''), reverse=True)
    if limit is not None:
        needs_attention = needs_attention[:limit]
    return {
        'total': len(rows),
        'counts': counts,
        'needs_attention': needs_attention,
        'labels': {key: label for key, label, _ in checks},
    }
