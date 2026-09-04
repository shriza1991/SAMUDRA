"""Root Pytest Configuration and Test Fixtures."""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend path is on sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from backend.app.main import app


@pytest.fixture
def client():
    """Returns FastAPI synchronous TestClient."""
    with TestClient(app) as test_client:
        yield test_client
