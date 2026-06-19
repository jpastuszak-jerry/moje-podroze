import unittest
from unittest.mock import patch

import locations


class LocationReadCacheTests(unittest.TestCase):
    def setUp(self):
        locations.clear_location_read_cache()

    def tearDown(self):
        locations.clear_location_read_cache()

    def test_payload_is_reused_until_database_write_version_changes(self):
        calls = []
        versions = iter([0, 0, 1])

        def build_payload():
            calls.append(len(calls) + 1)
            return [{'call': calls[-1]}]

        with (
            patch.object(locations, 'LOCATION_READ_CACHE_TTL_SECONDS', 30),
            patch.object(
                locations,
                'get_db_write_version',
                side_effect=lambda: next(versions),
            ),
        ):
            first = locations._cached_location_payload('locations', build_payload)
            second = locations._cached_location_payload('locations', build_payload)
            third = locations._cached_location_payload('locations', build_payload)

        self.assertIs(first, second)
        self.assertEqual(first[0]['call'], 1)
        self.assertEqual(third[0]['call'], 2)
        self.assertEqual(calls, [1, 2])

    def test_zero_ttl_disables_cache(self):
        calls = []

        def build_payload():
            calls.append(len(calls) + 1)
            return calls[-1]

        with patch.object(locations, 'LOCATION_READ_CACHE_TTL_SECONDS', 0):
            first = locations._cached_location_payload('locations', build_payload)
            second = locations._cached_location_payload('locations', build_payload)

        self.assertEqual((first, second), (1, 2))


if __name__ == '__main__':
    unittest.main()
