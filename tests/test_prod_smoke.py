import json
import unittest

from tools import smoke_prod


class FakeSmokeClient:
    def __init__(self, responses):
        self.responses = responses

    def get(self, path):
        return self.responses[path]


def response(payload=b"", *, headers=None, status=200):
    if not isinstance(payload, bytes):
        payload = json.dumps(payload).encode("utf-8")
    return smoke_prod.Response(
        url="https://example.test/",
        status=status,
        headers={key.lower(): value for key, value in (headers or {}).items()},
        body=payload,
        elapsed_ms=12,
    )


class ProductionSmokeTests(unittest.TestCase):
    def test_healthz_checks_build_revision_against_expected_head(self):
        client = FakeSmokeClient({
            "/healthz": response({
                "status": "ok",
                "db": "ok",
                "build": {
                    "app_version": "1.1.0",
                    "source_revision": "abcdef1234567890",
                    "source_revision_short": "abcdef1",
                    "source_revision_source": ".git",
                },
            }),
        })

        result = smoke_prod.check_healthz(client, "abcdef1234567890", False)

        self.assertTrue(result.ok)
        self.assertIn("build abcdef1", result.detail)

    def test_healthz_fails_when_deployed_revision_differs(self):
        client = FakeSmokeClient({
            "/healthz": response({
                "status": "ok",
                "db": "ok",
                "build": {
                    "app_version": "1.1.0",
                    "source_revision": "abcdef1234567890",
                    "source_revision_short": "abcdef1",
                    "source_revision_source": ".git",
                },
            }),
        })

        result = smoke_prod.check_healthz(client, "1234567890abcdef", False)

        self.assertFalse(result.ok)
        self.assertIn("does not match expected", result.detail)

    def test_security_headers_validate_map_csp_dependencies(self):
        client = FakeSmokeClient({
            "/": response(
                b"<html></html>",
                headers={
                    "Content-Security-Policy": (
                        "default-src 'self'; "
                        "connect-src 'self' https://unpkg.com https://nominatim.openstreetmap.org; "
                        "frame-ancestors 'none'"
                    ),
                    "X-Content-Type-Options": "nosniff",
                    "X-Frame-Options": "DENY",
                    "Referrer-Policy": "strict-origin-when-cross-origin",
                },
            ),
        })

        result = smoke_prod.check_security_headers(client)

        self.assertTrue(result.ok)

    def test_security_headers_fail_without_unpkg_connect_src(self):
        client = FakeSmokeClient({
            "/": response(
                b"<html></html>",
                headers={
                    "Content-Security-Policy": (
                        "default-src 'self'; "
                        "connect-src 'self' https://nominatim.openstreetmap.org; "
                        "frame-ancestors 'none'"
                    ),
                    "X-Content-Type-Options": "nosniff",
                    "X-Frame-Options": "DENY",
                    "Referrer-Policy": "strict-origin-when-cross-origin",
                },
            ),
        })

        result = smoke_prod.check_security_headers(client)

        self.assertFalse(result.ok)
        self.assertIn("https://unpkg.com", result.detail)


if __name__ == "__main__":
    unittest.main()
