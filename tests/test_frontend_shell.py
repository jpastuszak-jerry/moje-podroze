import os
import re
import unittest
from unittest.mock import patch

import app as app_module


def authenticate_client(client):
    with client.session_transaction() as sess:
        sess[app_module.AUTH_SESSION_KEY] = True


def script_srcs(html):
    return re.findall(r'<script src="([^"]+)"', html)


def static_js_srcs(html):
    return [src for src in script_srcs(html) if src.startswith('/static/js/')]


class FrontendShellSmokeTests(unittest.TestCase):
    def setUp(self):
        self.client = app_module.app.test_client()

    def test_authenticated_shell_loads_spa_assets_in_dependency_order(self):
        authenticate_client(self.client)

        with patch.object(app_module, 'static_asset_version', return_value='shellsmoke'):
            response = self.client.get('/')

        self.assertEqual(response.status_code, 200)
        html = response.get_data(as_text=True)

        expected_js = [
            '/static/js/utils.js?v=shellsmoke',
            '/static/js/components.js?v=shellsmoke',
            '/static/js/map.js?v=shellsmoke',
            '/static/js/travels.js?v=shellsmoke',
            '/static/js/locations.js?v=shellsmoke',
            '/static/js/location_inspirations.js?v=shellsmoke',
            '/static/js/dictionaries.js?v=shellsmoke',
            '/static/js/persons.js?v=shellsmoke',
            '/static/js/stats_yearbook.js?v=shellsmoke',
            '/static/js/stats.js?v=shellsmoke',
            '/static/js/todo.js?v=shellsmoke',
            '/static/js/wizard.js?v=shellsmoke',
        ]
        self.assertEqual(static_js_srcs(html), expected_js)

        for src in expected_js:
            path = src.split('?v=', 1)[0].lstrip('/').replace('/', os.sep)
            self.assertTrue(os.path.exists(path), f'Missing static asset: {path}')

        self.assertIn('/static/css/app.css?v=shellsmoke', html)
        self.assertIn('/static/manifest.json?v=shellsmoke', html)
        self.assertIn('/static/icons/icon-192.png?v=shellsmoke', html)
        self.assertIn('/static/icons/apple-touch-icon.png?v=shellsmoke', html)

        for tab in ('travels', 'locations', 'map', 'stats'):
            self.assertIn(f'id="tab-{tab}"', html)
            self.assertIn(f"showTab('{tab}')", html)

        self.assertIn('id="view"', html)
        self.assertIn('id="tabs"', html)
        self.assertIn('id="app-menu"', html)
        self.assertIn('setThemeIcon();', html)
        self.assertIn('updateOfflineBanner();', html)
        self.assertIn('startRouter();', html)
        self.assertIn("navigator.serviceWorker.register('/sw.js')", html)
        self.assertNotIn('class="auth-page"', html)

    def test_login_shell_does_not_boot_private_spa_before_authentication(self):
        with (
            patch.object(app_module, 'ADMIN_PASSWORD', 'secret'),
            patch.object(app_module, 'ADMIN_PASSWORD_HASH', None),
            patch.object(app_module, 'static_asset_version', return_value='shellsmoke'),
        ):
            response = self.client.get('/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        html = response.get_data(as_text=True)

        self.assertIn('class="auth-page"', html)
        self.assertIn('id="admin-password"', html)
        self.assertIn('submitLogin(event)', html)
        self.assertIn('/static/css/app.css?v=shellsmoke', html)
        self.assertEqual(static_js_srcs(html), [])
        self.assertNotIn('id="tabs"', html)
        self.assertNotIn('id="app-menu"', html)
        self.assertNotIn('renderTravels();', html)
        self.assertNotIn('startRouter();', html)
        self.assertNotIn("navigator.serviceWorker.register('/sw.js')", html)


if __name__ == '__main__':
    unittest.main()
