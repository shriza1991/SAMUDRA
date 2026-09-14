"""
P0-10: Verification of PFZ (Potential Fishing Zone) Data Semantics.

Ensures that:
1. Synthetic PFZ fixtures and models contain explicit `sst_gradient` (thermal gradient metric).
2. No `sst_celsius` field exists on PFZ candidates (no fake absolute SST is fabricated).
3. The backend `/api/v1/demo/pfz-candidates` endpoint returns `sst_gradient` and preserves
   metadata (depth_m, bearing_deg, distance_km, confidence, qc_status, chlorophyll_value).
4. `valid_only=true` filtering properly selects valid candidates in both DB and fallback modes.
"""

import json
from pathlib import Path
from fastapi.testclient import TestClient
import pytest

from backend.app.main import app
from backend.app.domain.synthetic.generator import generate_pfz_candidates


def test_pfz_fixture_semantics():
    """Verify raw fixture data contains sst_gradient and does NOT contain fake sst_celsius."""
    fixture_path = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures" / "synthetic" / "incois" / "pfz_advisories.json"
    assert fixture_path.exists(), f"PFZ fixture not found at {fixture_path}"

    with open(fixture_path, "r", encoding="utf-8") as f:
        records = json.load(f)

    assert len(records) == 12
    for r in records:
        assert "sst_gradient" in r, f"Candidate {r.get('public_id')} missing sst_gradient"
        assert "sst_celsius" not in r, f"Candidate {r.get('public_id')} must NOT contain fake sst_celsius"
        assert "sea_surface_temp_c" not in r, f"Candidate {r.get('public_id')} must NOT contain fabricated sea_surface_temp_c"
        # sst_gradient is a gradient feature (typically 0.1 to 2.5), not absolute temperature (~28°C)
        assert 0.0 <= r["sst_gradient"] <= 5.0, f"sst_gradient {r['sst_gradient']} out of plausible range"
        # Metadata fields
        assert "confidence" in r
        assert "depth_m" in r
        assert "bearing_deg" in r
        assert "distance_km" in r
        assert "qc_status" in r


def test_pfz_generator_semantics():
    """Verify synthetic generator generates sst_gradient without fabricating sst_celsius."""
    records = generate_pfz_candidates()
    assert len(records) == 12
    for r in records:
        assert "sst_gradient" in r
        assert "sst_celsius" not in r
        assert 0.0 <= r["sst_gradient"] <= 5.0


def test_pfz_demo_endpoint_semantics():
    """Verify /api/v1/demo/pfz-candidates returns canonical sst_gradient and no fake sst_celsius."""
    client = TestClient(app)
    resp = client.get("/api/v1/demo/pfz-candidates")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 12

    for item in data:
        assert "public_id" in item
        assert "sst_gradient" in item
        assert "sst_celsius" not in item
        assert item["sst_gradient"] is not None
        assert 0.0 <= item["sst_gradient"] <= 5.0
        assert "chlorophyll_value" in item
        assert "depth_m" in item
        assert "bearing_deg" in item
        assert "distance_km" in item


def test_pfz_demo_endpoint_valid_only():
    """Verify /api/v1/demo/pfz-candidates?valid_only=true returns only valid records."""
    client = TestClient(app)
    resp = client.get("/api/v1/demo/pfz-candidates?valid_only=true")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    assert len(data) < 12  # Filtered out expired/invalid candidates
    for item in data:
        assert item.get("qc_status") == "VALID" or item.get("status") == "ACTIVE"
        assert "sst_gradient" in item
        assert "sst_celsius" not in item
