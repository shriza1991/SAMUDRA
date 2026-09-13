from backend.app.api.v1 import routes


def test_estimate_is_bounded_and_uses_latest_canonical_state(monkeypatch):
    replay = [
        {"vessel_id": "vessel-01", "timestamp": "2026-01-01T00:00:00Z", "latitude": 16.0, "longitude": 73.0, "speed_knots": 5.0, "heading_deg": 0.0},
        {"vessel_id": "vessel-01", "timestamp": "2026-01-01T01:00:00Z", "latitude": 16.1, "longitude": 73.1, "speed_knots": 10.0, "heading_deg": 90.0},
    ]
    monkeypatch.setattr(routes, "get_demo_vessel_replay", lambda *_args, **_kwargs: replay)
    result = routes.get_demo_vessel_estimated_trajectory("vessel-01")
    assert result["vessel_id"] == "vessel-01"
    assert [p["offset_minutes"] for p in result["points"]] == [0, 5, 10, 15, 20, 25, 30]
    assert result["points"][0] == {"latitude": 16.1, "longitude": 73.1, "offset_minutes": 0}
    assert result["points"][-1]["longitude"] > 73.1


def test_estimate_is_unavailable_without_movement_state(monkeypatch):
    monkeypatch.setattr(routes, "get_demo_vessel_replay", lambda *_args, **_kwargs: [{"vessel_id": "vessel-02", "timestamp": "2026-01-01T00:00:00Z", "latitude": 16.0, "longitude": 73.0, "speed_knots": None, "heading_deg": 20.0}])
    assert routes.get_demo_vessel_estimated_trajectory("vessel-02")["status"] == "UNAVAILABLE"
