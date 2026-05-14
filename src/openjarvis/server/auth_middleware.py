"""API key authentication middleware for the OpenJarvis server."""

from __future__ import annotations

import logging
import os
import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class AuthMiddleware(BaseHTTPMiddleware):
    """Validates Authorization: Bearer <key> on /v1/* and /api/* routes.

    Webhook routes and health checks are exempt — they use
    per-channel signature verification instead.

    Browser requests from the built-in WebUI (same-origin) are also
    exempt so the frontend works without needing to send API keys.
    """

    def __init__(self, app, api_key: str = "") -> None:  # noqa: ANN001
        super().__init__(app)
        self._api_key = api_key or os.environ.get("OPENJARVIS_API_KEY", "")

    async def dispatch(self, request: Request, call_next):  # noqa: ANN001
        if self._api_key and self._requires_auth(request.url.path):
            # Allow browser requests from the built-in WebUI (same-origin)
            if self._is_browser_same_origin(request):
                return await call_next(request)
            auth = request.headers.get("Authorization", "")
            if not auth:
                return JSONResponse(
                    {"detail": "Missing Authorization header"},
                    status_code=401,
                )
            scheme, _, token = auth.partition(" ")
            if scheme.lower() != "bearer" or token != self._api_key:
                return JSONResponse(
                    {"detail": "Invalid API key"},
                    status_code=401,
                )
        return await call_next(request)

    @staticmethod
    def _requires_auth(path: str) -> bool:
        """Only protect API routes, not the frontend UI or static assets."""
        return path.startswith("/v1/") or path.startswith("/api/")

    @staticmethod
    def _is_browser_same_origin(request: Request) -> bool:
        """Check if the request comes from the built-in WebUI.

        Uses the Sec-Fetch-Site header which modern browsers set
        automatically on all fetch/XHR requests.  This header is a
        *forbidden* header name — JavaScript cannot override it, making
        it a reliable same-origin indicator.

        Falls back to Origin / Referer checks for older browsers.
        """
        # Sec-Fetch-Site is the most reliable check (cannot be spoofed)
        sec_fetch_site = request.headers.get("sec-fetch-site", "")
        if sec_fetch_site == "same-origin":
            return True

        host = request.headers.get("host", "")
        origin = request.headers.get("origin", "")
        referer = request.headers.get("referer", "")

        if not host:
            return False

        # Check Origin header (set on POST/cross-origin fetch requests)
        if origin:
            for scheme in ("http://", "https://"):
                if origin == f"{scheme}{host}":
                    return True

        # Check Referer header (set on navigation and fetch)
        if referer:
            for scheme in ("http://", "https://"):
                if referer.startswith(f"{scheme}{host}/") or referer == f"{scheme}{host}":
                    return True

        return False


def generate_api_key() -> str:
    """Generate a new API key with oj_sk_ prefix."""
    return f"oj_sk_{secrets.token_urlsafe(32)}"


def check_bind_safety(host: str, *, api_key: str) -> None:
    """Refuse to bind non-loopback without an API key.

    Raises SystemExit if *host* is not a loopback address and
    *api_key* is empty.
    """
    import ipaddress
    import sys

    try:
        is_loop = ipaddress.ip_address(host).is_loopback
    except ValueError:
        is_loop = host in ("localhost", "")

    if os.environ.get("OPENJARVIS_SKIP_BIND_CHECK"):
        return
    if not is_loop and not api_key:
        logger.error(
            "Binding to %s requires OPENJARVIS_API_KEY to be set. "
            "Run: jarvis auth generate-key",
            host,
        )
        sys.exit(1)
