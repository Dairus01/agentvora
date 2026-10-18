"""Server-only credential failover for the native provider client's HTTP requests."""

import httpx


class GroqKeyFailover(httpx.Auth):
    def __init__(self, primary, backup):
        self._primary = primary
        self._backup = backup

    def auth_flow(self, request):
        if request.url.host != "api.groq.com":
            yield request
            return
        request.headers["Authorization"] = f"Bearer {self._primary}"
        response = yield request
        if (
            response.status_code in (401, 403, 429, 500, 502, 503, 504)
            and self._backup
            and self._backup != self._primary
        ):
            response.read()
            retry = httpx.Request(
                request.method,
                request.url,
                headers={**request.headers, "authorization": f"Bearer {self._backup}"},
                content=request.content,
                extensions=request.extensions,
            )
            yield retry
