import unittest
from unittest.mock import patch

import stats


class StatsCacheTests(unittest.TestCase):
    def setUp(self):
        stats.clear_stats_cache()

    def tearDown(self):
        stats.clear_stats_cache()

    def test_stats_payload_reuses_cache_until_db_write_version_changes(self):
        calls = []
        versions = iter([0, 0, 1])

        def build_payload(year):
            calls.append(year)
            return {'year': year, 'call': len(calls), 'items': []}

        with (
            patch.object(stats, 'STATS_CACHE_TTL_SECONDS', 30),
            patch.object(stats, 'get_db_write_version', side_effect=lambda: next(versions)),
            patch.object(stats, '_build_stats_payload', side_effect=build_payload),
        ):
            first = stats._stats_payload(2025)
            first['items'].append('mutated outside cache')
            second = stats._stats_payload(2025)
            third = stats._stats_payload(2025)

        self.assertEqual(first['call'], 1)
        self.assertEqual(second['call'], 1)
        self.assertEqual(second['items'], [])
        self.assertEqual(third['call'], 2)
        self.assertEqual(calls, [2025, 2025])


if __name__ == '__main__':
    unittest.main()
