"""Root Pytest Configuration and Test Fixtures."""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure project root and backend path are on sys.path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    import langgraph
except ImportError:
    from unittest.mock import MagicMock
    sys.modules['langgraph'] = MagicMock()
    sys.modules['langgraph.graph'] = MagicMock()


from backend.app.main import app


@pytest.fixture
def client():
    """Returns FastAPI synchronous TestClient."""
    with TestClient(app) as test_client:
        yield test_client
