import importlib.util
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

# Ensure project root and backend path are on sys.path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

if importlib.util.find_spec("langgraph") is None:
    sys.modules["langgraph"] = MagicMock()
    sys.modules["langgraph.graph"] = MagicMock()

from backend.app.agents.memory import InMemoryConversationStore, memory_manager  # noqa: E402
from backend.app.main import app  # noqa: E402

# Force in-memory store for all agent evaluations so they don't require Postgres
memory_manager.set_store(InMemoryConversationStore())


@pytest.fixture
def client():
    """Returns FastAPI synchronous TestClient."""
    with TestClient(app) as test_client:
        yield test_client
