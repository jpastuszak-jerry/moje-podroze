"""
Bezsekretowy smoke test produkcji po deployu Rendera.

Domyslnie sprawdza https://moje-podroze.onrender.com i nie wykonuje logowania.
Skrypt ma potwierdzic, ze proces wystartowal, baza odpowiada, auth jest
skonfigurowany, prywatne API jest zablokowane bez sesji, a shell/PWA assety
sa dostepne.
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "https://moje-podroze.onrender.com"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
KEY_ICON_PATHS = (
    "/static/icons/icon-192.png",
    "/static/icons/icon-512.png",
    "/static/icons/icon-maskable-512.png",
    "/static/icons/favicon-32.png",
    "/static/icons/apple-touch-icon.png",
)


def _read_packed_ref(git_dir: Path, ref: str) -> str | None:
    packed_refs = git_dir / "packed-refs"
    try:
        for line in packed_refs.read_text(encoding="utf-8").splitlines():
            if not line or line.startswith(("#", "^")):
                continue
            revision, _, ref_name = line.partition(" ")
            if ref_name == ref:
                return revision.strip()
    except OSError:
        return None
    return None


def local_git_revision() -> str | None:
    git_dir = Path(__file__).resolve().parents[1] / ".git"
    try:
        if git_dir.is_file():
            content = git_dir.read_text(encoding="utf-8").strip()
            if content.startswith("gitdir:"):
                path = Path(content.split(":", 1)[1].strip())
                git_dir = path if path.is_absolute() else git_dir.parent / path
        head = (git_dir / "HEAD").read_text(encoding="utf-8").strip()
    except OSError:
        return None
    if head.startswith("ref:"):
        ref = head.split(":", 1)[1].strip()
        try:
            return (git_dir / ref).read_text(encoding="utf-8").strip() or None
        except OSError:
            return _read_packed_ref(git_dir, ref)
    return head or None


@dataclass
class Response:
    url: str
    status: int
    headers: dict[str, str]
    body: bytes
    elapsed_ms: int

    def header(self, name: str) -> str:
        return self.headers.get(name.lower(), "")

    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")

    def json(self) -> Any:
        return json.loads(self.text())


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str
    status: int | None = None
    elapsed_ms: int | None = None


def create_tls_context(strict_tls: bool) -> ssl.SSLContext:
    context = ssl.create_default_context()
    strict_flag = getattr(ssl, "VERIFY_X509_STRICT", 0)
    if not strict_tls and strict_flag:
        # Windows/proxy CA chains can trip OpenSSL's strict extension checks even
        # when the same certificate is accepted by browsers and PowerShell.
        # Hostname and trust-chain verification stay enabled.
        context.verify_flags &= ~strict_flag
    return context


class SmokeClient:
    def __init__(self, base_url: str, timeout: float, strict_tls: bool):
        self.base_url = base_url.rstrip("/") + "/"
        self.timeout = timeout
        self.tls_context = create_tls_context(strict_tls)

    def url(self, path: str) -> str:
        return urljoin(self.base_url, path.lstrip("/"))

    def get(self, path: str) -> Response:
        url = self.url(path)
        request = Request(
            url,
            headers={
                "Accept": "*/*",
                "User-Agent": "moje-podroze-prod-smoke/1.0",
            },
        )
        started = time.perf_counter()
        try:
            with urlopen(request, timeout=self.timeout, context=self.tls_context) as response:
                body = response.read()
                status = response.status
                headers = {key.lower(): value for key, value in response.headers.items()}
        except HTTPError as error:
            body = error.read()
            status = error.code
            headers = {key.lower(): value for key, value in error.headers.items()}
        except URLError as error:
            raise RuntimeError(str(error.reason)) from error
        except TimeoutError as error:
            raise RuntimeError("request timed out") from error
        elapsed_ms = round((time.perf_counter() - started) * 1000)
        return Response(url=url, status=status, headers=headers, body=body, elapsed_ms=elapsed_ms)


def _ok(name: str, response: Response, detail: str) -> CheckResult:
    return CheckResult(name, True, detail, response.status, response.elapsed_ms)


def _fail(name: str, response: Response | None, detail: str) -> CheckResult:
    if response is None:
        return CheckResult(name, False, detail)
    return CheckResult(name, False, detail, response.status, response.elapsed_ms)


def _json_or_fail(response: Response, name: str) -> tuple[Any | None, CheckResult | None]:
    try:
        return response.json(), None
    except (TypeError, ValueError) as error:
        return None, _fail(name, response, f"invalid JSON: {error}")


def _revision_matches(actual: str, expected: str) -> bool:
    actual = actual.lower().strip()
    expected = expected.lower().strip()
    return bool(actual and expected and (actual.startswith(expected) or expected.startswith(actual)))


def check_healthz(client: SmokeClient, expected_revision: str | None, skip_revision_check: bool) -> CheckResult:
    name = "healthz"
    try:
        response = client.get("/healthz")
    except RuntimeError as error:
        return _fail(name, None, str(error))
    if response.status != 200:
        return _fail(name, response, "expected HTTP 200")
    payload, error = _json_or_fail(response, name)
    if error:
        return error
    if payload.get("status") != "ok" or payload.get("db") != "ok":
        return _fail(name, response, f"expected status/db ok, got {payload!r}")
    build = payload.get("build") or {}
    if not isinstance(build, dict):
        return _fail(name, response, f"missing build object, got {payload!r}")
    revision = str(build.get("source_revision") or "")
    short_revision = str(build.get("source_revision_short") or "")
    if revision and short_revision and not revision.startswith(short_revision):
        return _fail(name, response, f"build short revision does not match full revision: {build!r}")
    if expected_revision and not skip_revision_check:
        if not revision:
            return _fail(name, response, f"build revision missing, expected {expected_revision[:12]}")
        if not _revision_matches(revision, expected_revision):
            return _fail(
                name,
                response,
                f"deployed revision {revision[:12]} does not match expected {expected_revision[:12]}",
            )
    detail = "DB ok"
    if short_revision:
        detail += f", build {short_revision}"
    elif skip_revision_check:
        detail += ", build revision skipped"
    else:
        detail += ", build revision unavailable"
    return _ok(name, response, detail)


def _csp_directives(header: str) -> dict[str, set[str]]:
    directives: dict[str, set[str]] = {}
    for part in header.split(";"):
        tokens = part.strip().split()
        if tokens:
            directives[tokens[0]] = set(tokens[1:])
    return directives


def check_security_headers(client: SmokeClient) -> CheckResult:
    name = "security headers"
    try:
        response = client.get("/")
    except RuntimeError as error:
        return _fail(name, None, str(error))
    if response.status != 200:
        return _fail(name, response, "expected HTTP 200")
    csp = response.header("content-security-policy")
    if not csp:
        return _fail(name, response, "missing Content-Security-Policy")
    directives = _csp_directives(csp)
    connect_src = directives.get("connect-src") or set()
    required_connect = {"'self'", "https://unpkg.com", "https://nominatim.openstreetmap.org"}
    missing_connect = sorted(required_connect - connect_src)
    if missing_connect:
        return _fail(name, response, "CSP connect-src missing: " + ", ".join(missing_connect))
    required_headers = {
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "referrer-policy": "strict-origin-when-cross-origin",
    }
    for header, expected in required_headers.items():
        if response.header(header).lower() != expected.lower():
            return _fail(name, response, f"unexpected {header}: {response.header(header) or '(missing)'}")
    if directives.get("frame-ancestors") != {"'none'"}:
        return _fail(name, response, "CSP frame-ancestors should be 'none'")
    return _ok(name, response, "CSP/connect-src and security headers ok")


def check_shell(client: SmokeClient) -> CheckResult:
    name = "app shell"
    try:
        response = client.get("/")
    except RuntimeError as error:
        return _fail(name, None, str(error))
    if response.status != 200:
        return _fail(name, response, "expected HTTP 200")
    body = response.body
    required = (
        b"<title",
        b"/static/manifest.json",
        b"/static/icons/icon-192.png",
        b"/static/css/app.css",
        b"class=\"auth-page\"",
    )
    missing = [marker.decode("ascii", errors="replace") for marker in required if marker not in body]
    if missing:
        return _fail(name, response, "missing shell markers: " + ", ".join(missing))
    return _ok(name, response, "login shell and static references present")


def check_auth_status(client: SmokeClient, allow_unconfigured_auth: bool) -> CheckResult:
    name = "auth status"
    try:
        response = client.get("/api/auth/status")
    except RuntimeError as error:
        return _fail(name, None, str(error))
    if response.status != 200:
        return _fail(name, response, "expected HTTP 200")
    payload, error = _json_or_fail(response, name)
    if error:
        return error
    if payload.get("authenticated") is not False:
        return _fail(name, response, f"expected unauthenticated session, got {payload!r}")
    if payload.get("role") is not None:
        return _fail(name, response, f"expected no role before login, got {payload!r}")
    if not allow_unconfigured_auth and payload.get("configured") is not True:
        return _fail(name, response, "auth is not configured on target")
    if "no-store" not in response.header("cache-control").lower():
        return _fail(name, response, "missing Cache-Control: no-store")
    configured = "configured" if payload.get("configured") else "not configured"
    return _ok(name, response, f"unauthenticated, auth {configured}")


def check_private_api_blocked(client: SmokeClient) -> CheckResult:
    name = "private API guard"
    try:
        response = client.get("/api/travels")
    except RuntimeError as error:
        return _fail(name, None, str(error))
    if response.status != 401:
        return _fail(name, response, "expected HTTP 401 without session")
    payload, error = _json_or_fail(response, name)
    if error:
        return error
    if payload.get("error") != "unauthorized":
        return _fail(name, response, f"expected unauthorized error, got {payload!r}")
    if "no-store" not in response.header("cache-control").lower():
        return _fail(name, response, "missing Cache-Control: no-store")
    return _ok(name, response, "unauthenticated /api/travels returns 401 no-store")


def check_service_worker(client: SmokeClient) -> CheckResult:
    name = "service worker"
    try:
        response = client.get("/sw.js")
    except RuntimeError as error:
        return _fail(name, None, str(error))
    if response.status != 200:
        return _fail(name, response, "expected HTTP 200")
    body = response.text()
    required = (
        "const CACHE_VERSION",
        "const APP_SHELL",
        "const NO_STORE_API_PREFIXES",
        '"/api/auth"',
        '"/api/stats"',
        '"/api/travels"',
    )
    missing = [marker for marker in required if marker not in body]
    if missing:
        return _fail(name, response, "missing SW markers: " + ", ".join(missing))
    placeholder_assignments = (
        "const CACHE_VERSION = '__VERSION__';",
        "const APP_SHELL = '__APP_SHELL__';",
        "new Set('__NO_STORE_API_EXACT_PATHS__')",
        "const NO_STORE_API_PREFIXES = '__NO_STORE_API_PREFIXES__';",
    )
    if any(marker in body for marker in placeholder_assignments):
        return _fail(name, response, "service worker placeholders were not injected")
    if "no-cache" not in response.header("cache-control").lower():
        return _fail(name, response, "missing Cache-Control: no-cache")
    return _ok(name, response, "generated SW includes cache policy")


def check_manifest(client: SmokeClient) -> CheckResult:
    name = "manifest"
    try:
        response = client.get("/static/manifest.json")
    except RuntimeError as error:
        return _fail(name, None, str(error))
    if response.status != 200:
        return _fail(name, response, "expected HTTP 200")
    payload, error = _json_or_fail(response, name)
    if error:
        return error
    icon_paths = {icon.get("src") for icon in payload.get("icons", [])}
    missing_icons = [path for path in KEY_ICON_PATHS[:3] if path not in icon_paths]
    if payload.get("start_url") != "/" or payload.get("scope") != "/":
        return _fail(name, response, f"unexpected start_url/scope in manifest: {payload!r}")
    if missing_icons:
        return _fail(name, response, "manifest missing icons: " + ", ".join(missing_icons))
    return _ok(name, response, f"{len(icon_paths)} manifest icons")


def check_icon(client: SmokeClient, path: str) -> CheckResult:
    name = "icon " + path.rsplit("/", 1)[-1]
    try:
        response = client.get(path)
    except RuntimeError as error:
        return _fail(name, None, str(error))
    if response.status != 200:
        return _fail(name, response, "expected HTTP 200")
    if not response.body.startswith(PNG_SIGNATURE):
        return _fail(name, response, "response is not a PNG")
    content_type = response.header("content-type").lower()
    if "image/png" not in content_type:
        return _fail(name, response, f"unexpected content-type: {content_type or '(missing)'}")
    return _ok(name, response, f"{len(response.body)} bytes")


def run_smoke(
    base_url: str,
    timeout: float,
    allow_unconfigured_auth: bool,
    strict_tls: bool,
    expected_revision: str | None,
    skip_revision_check: bool,
) -> list[CheckResult]:
    client = SmokeClient(base_url, timeout, strict_tls)
    checks = [
        check_healthz(client, expected_revision, skip_revision_check),
        check_security_headers(client),
        check_shell(client),
        check_auth_status(client, allow_unconfigured_auth),
        check_private_api_blocked(client),
        check_service_worker(client),
        check_manifest(client),
    ]
    checks.extend(check_icon(client, path) for path in KEY_ICON_PATHS)
    return checks


def print_report(base_url: str, results: list[CheckResult]) -> None:
    print(f"Production smoke target: {base_url.rstrip('/')}")
    print()
    for result in results:
        prefix = "OK  " if result.ok else "FAIL"
        status = f"HTTP {result.status}" if result.status is not None else "no response"
        elapsed = f"{result.elapsed_ms} ms" if result.elapsed_ms is not None else "-"
        print(f"{prefix} {result.name:<24} {status:<12} {elapsed:<8} {result.detail}")
    print()
    passed = sum(1 for result in results if result.ok)
    failed = len(results) - passed
    print(f"Summary: {passed} passed, {failed} failed")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a no-secret production smoke test for moje-podroze.",
    )
    parser.add_argument(
        "base_url",
        nargs="?",
        default=os.environ.get("MOJE_PODROZE_URL", DEFAULT_BASE_URL),
        help=f"Base URL to check (default: {DEFAULT_BASE_URL}, or MOJE_PODROZE_URL).",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="Per-request timeout in seconds (default: 30).",
    )
    parser.add_argument(
        "--allow-unconfigured-auth",
        action="store_true",
        help="Do not fail when /api/auth/status reports configured=false.",
    )
    parser.add_argument(
        "--strict-tls",
        action="store_true",
        help="Keep OpenSSL strict certificate-extension checks enabled.",
    )
    parser.add_argument(
        "--expect-revision",
        default=os.environ.get("MOJE_PODROZE_EXPECT_REVISION") or local_git_revision(),
        help="Expected deployed Git revision. Defaults to MOJE_PODROZE_EXPECT_REVISION or local HEAD.",
    )
    parser.add_argument(
        "--skip-revision-check",
        action="store_true",
        help="Do not compare /healthz build.source_revision with the expected revision.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    results = run_smoke(
        args.base_url,
        args.timeout,
        args.allow_unconfigured_auth,
        args.strict_tls,
        args.expect_revision,
        args.skip_revision_check,
    )
    print_report(args.base_url, results)
    return 1 if any(not result.ok for result in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
