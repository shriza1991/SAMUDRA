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

from backend.app.main import app
from backend.app.agents.memory import memory_manager, InMemoryConversationStore

# Force in-memory store for all agent evaluations so they don't require Postgres
memory_manager.set_store(InMemoryConversationStore())

@pytest.fixture
def client():
    """Returns FastAPI synchronous TestClient."""
    with TestClient(app) as test_client:
        yield test_client
