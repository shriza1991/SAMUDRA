"""Global HTTP Client for Connectors.

Owned by Dev 2 (Backend Platform).
Provides connection pooling and reuse across all Live connectors.
"""

import httpx

# Shared HTTP client for all synchronous requests in Dev 2 connectors
# Implements Requirement 16 (Connection reuse) and Requirement 1 (Timeout configuration)
connector_http_client = httpx.Client(
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
