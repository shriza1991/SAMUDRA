"""Global HTTP Client for Connectors.

Owned by Dev 2 (Backend Platform).
Provides connection pooling and reuse across all Live connectors.
"""

import httpx

def _create_client() -> httpx.Client:
    return httpx.Client(
        timeout=httpx.Timeout(
            connect=2.0,
            read=4.0,
            write=2.0,
            pool=2.0,
        ),
        limits=httpx.Limits(
            max_keepalive_connections=20,
            max_connections=100,
        ),
    )


class _ConnectorHttpClientProxy:
    """Proxy around httpx.Client ensuring auto-reinitialization if closed during test teardowns."""

    def __init__(self) -> None:
        self._client = _create_client()

    @property
    def client(self) -> httpx.Client:
        if self._client.is_closed:
            self._client = _create_client()
        return self._client

    def get(self, *args, **kwargs) -> httpx.Response:
        return self.client.get(*args, **kwargs)

    def post(self, *args, **kwargs) -> httpx.Response:
        return self.client.post(*args, **kwargs)

    def close(self) -> None:
        self._client.close()

    def __getattr__(self, name: str):
        return getattr(self.client, name)


connector_http_client = _ConnectorHttpClientProxy()
