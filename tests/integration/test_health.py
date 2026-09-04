"""Integration tests for FastAPI health and system metadata routes."""

from fastapi.testclient import TestClient


def test_health_check_endpoint(client: TestClient):
    """GET /api/v1/health should return 200 with operational mode."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app_name"] == "SAMUDRA"
    assert "data_mode" in data


def test_scenarios_listing_endpoint(client: TestClient):
    """GET /api/v1/scenarios should list the 8 canonical evaluation scenarios."""
    response = client.get("/api/v1/scenarios")
    assert response.status_code == 200
    data = response.json()
    assert "scenarios" in data
    assert len(data["scenarios"]) == 8
    scenario_ids = [s["id"] for s in data["scenarios"]]
    assert "S1" in scenario_ids
    assert "S8" in scenario_ids


def test_chat_placeholder_returns_501(client: TestClient):
    """POST /api/v1/chat should return 501 Not Implemented during foundation phase."""
    response = client.post(
        "/api/v1/chat",
        json={"message": "Is it safe to leave Ratnagiri?"},
    )
    assert response.status_code == 501
    assert "scaffolded" in response.json()["detail"].lower()
