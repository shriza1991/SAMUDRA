"""FastAPI Middlewares.

Owned by Dev 2 (Backend Platform).
Implements request IDs and size limits.
"""

import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Injects a unique request ID into every request state and response headers."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Limits incoming request payload size."""

    def __init__(
        self,
        app,
        max_upload_size: int = 1048576,
        max_voice_upload_size: int = 26214400,  # 25 MB for audio recordings
    ) -> None:
        super().__init__(app)
        self.max_upload_size = max_upload_size
        self.max_voice_upload_size = max_voice_upload_size

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method in ("POST", "PUT", "PATCH"):
            content_length = request.headers.get("content-length")
            if content_length:
                limit = (
                    self.max_voice_upload_size
                    if "/voice/" in request.url.path
                    else self.max_upload_size
                )
                if int(content_length) > limit:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "error": "PayloadTooLarge",
                            "message": f"Request body exceeds {limit} bytes limit.",
                        },
                    )
        return await call_next(request)

