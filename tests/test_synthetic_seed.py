"""Unit and Integration Tests for SAMUDRA Synthetic Demo Data Seeding Foundation.

Verifies:
- 3-tier provider schema fidelity and normalization
- Exact seed record counts across all 14 entity models
- Determinism and reproducibility
- Referential integrity (no orphaned foreign keys)
- Quality and edge case representations (missing != 0, stale != current, degraded QC, expired/distant PFZ)
- Spatial and topological validity via Shapely
- Seeder idempotency, namespace reset, and isolation
- Repository query methods
- DataService synthetic routing
- FastAPI REST /api/v1/demo/* endpoints
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from shapely.geometry import shape
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.connectors.normalizers.imd import ImdHazardNormalizer, ImdWeatherNormalizer
from backend.app.connectors.normalizers.incois import IncoisOSFNormalizer, IncoisPFZNormalizer
from backend.app.connectors.normalizers.mosdac import MosdacEONormalizer
from backend.app.core.config import settings
from backend.app.db.models import (
    Base,
    DemoEOGridCell,
    DemoFisher,
    DemoGeofence,
    DemoHarbor,
    DemoHazardEvent,
    DemoMarineObservation,
    DemoNotification,
    DemoPFZCandidate,
    DemoRouteEdge,
    DemoRouteNode,
    DemoStakeholder,
    DemoTrip,
    DemoVessel,
    DemoVesselReplayPosition,
)
from backend.app.db.repositories import SyntheticDemoRepository
from backend.app.domain.synthetic.generator import (
    DATASET_VERSION,
    REFERENCE_TIME,
    SYNTHETIC_NAMESPACE,
    generate_synthetic_demo_dataset,
)
from backend.app.domain.synthetic.seeder import reset_synthetic_demo, seed_synthetic_demo
from backend.app.domain.synthetic.validator import validate_synthetic_dataset
from backend.app.main import app
from backend.app.services.data_service import DataService


# ---------------------------------------------------------------------------
# In-Memory SQLite Fixture for Isolated DB Testing
# ---------------------------------------------------------------------------
@pytest.fixture
def sqlite_session():
    """Provides a fresh SQLite in-memory database session with demo tables."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Create tables for demo models
    DemoStakeholder.__table__.create(bind=engine)
    DemoHarbor.__table__.create(bind=engine)
    DemoFisher.__table__.create(bind=engine)
    DemoVessel.__table__.create(bind=engine)
    DemoTrip.__table__.create(bind=engine)
    DemoMarineObservation.__table__.create(bind=engine)
    DemoEOGridCell.__table__.create(bind=engine)
    DemoPFZCandidate.__table__.create(bind=engine)
    DemoGeofence.__table__.create(bind=engine)
    DemoRouteNode.__table__.create(bind=engine)
    DemoRouteEdge.__table__.create(bind=engine)
    DemoHazardEvent.__table__.create(bind=engine)
    DemoNotification.__table__.create(bind=engine)
    DemoVesselReplayPosition.__table__.create(bind=engine)

    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


# ---------------------------------------------------------------------------
# 1. Dataset Generation and Count Verification Tests
# ---------------------------------------------------------------------------
def test_dataset_generation_counts():
    """Verify that generate_synthetic_demo_dataset produces exact target record counts."""
    dataset = generate_synthetic_demo_dataset()

    expected_counts = {
        "stakeholders": 5,
        "harbors": 2,
        "fishers": 8,
        "vessels": 8,
        "trips": 12,
        "marine_observations": 96,
        "eo_grid_cells": 350,
        "pfz_candidates": 12,
        "geofences": 5,
        "route_nodes": 24,
        "route_edges": 32,
        "hazards": 10,
        "notifications": 20,
        "replay_positions": 60,
    }

    assert len(dataset) == len(expected_counts)
    for key, expected_count in expected_counts.items():
        assert len(dataset[key]) == expected_count, (
            f"Mismatch for '{key}': expected {expected_count}, got {len(dataset[key])}"
        )

    total_records = sum(len(v) for v in dataset.values())
    assert total_records == 644


def test_dataset_determinism():
    """Verify that two independent generation runs produce identical outputs."""
    run1 = generate_synthetic_demo_dataset()
    run2 = generate_synthetic_demo_dataset()

    assert json.dumps(run1, default=str) == json.dumps(run2, default=str)


# ---------------------------------------------------------------------------
# 2. Source Adapter / Normalizer Unit Tests
# ---------------------------------------------------------------------------
def test_incois_osf_normalizer():
    """Verify INCOIS OSF normalization logic and -999.0 missing value handling."""
    raw_osf = {
        "harbor": "Ratnagiri",
        "swh": 1.8,
        "swell_height": 1.1,
        "swell_period": 7.2,
        "current_speed": 1.1,
        "sst": -999.0,  # Missing sensor
        "observed_at": "2026-09-12T06:00:00Z",
        "valid_to": "2026-09-13T06:00:00Z",
        "qc_flag": 0,
    }
    payload = IncoisOSFNormalizer.normalize(raw_osf)

    assert payload.harbor == "Ratnagiri"
    assert payload.significant_wave_height_m == 1.8
    assert payload.swell_height_m == 1.1
    assert payload.swell_period_sec == 7.2
    assert payload.surface_current_knots == 1.1
    # Missing SST (-999.0) must be normalized to None
    assert payload.sea_surface_temp_c is None
    assert "INCOIS Ocean State Forecast (SYNTHETIC)" in payload.source_name


def test_incois_pfz_normalizer():
    """Verify INCOIS PFZ advisory normalization logic."""
    raw_pfz = {
        "features": [
            {
                "id": "PFZ-INCOIS-01",
                "lat": 16.85,
                "lon": 73.10,
                "sst_grad": 0.35,
                "chlorophyll": 1.85,
                "confidence": "HIGH",
                "depth_m": 45.0,
                "bearing_deg": 260.0,
                "distance_km": 16.5,
                "qc_status": "VALID",
            }
        ],
        "bulletin_date": "2026-09-12T00:00:00Z",
        "valid_to": "2026-09-13T23:59:59Z",
    }
    payload = IncoisPFZNormalizer.normalize(raw_pfz)

    assert len(payload.features) == 1
    assert payload.features[0]["id"] == "PFZ-INCOIS-01"
    assert payload.features[0]["lat"] == 16.85
    assert payload.features[0]["confidence"] == "HIGH"
    assert "INCOIS PFZ Mission (SYNTHETIC)" in payload.source_name


def test_imd_weather_and_hazard_normalizers():
    """Verify IMD weather and marine hazard normalizers."""
    raw_weather = {
        "harbor": "Ratnagiri",
        "wind_speed_knots": 15.0,
        "gust_speed_knots": -999.0,  # Missing sensor
        "wind_direction_deg": 230.0,
        "visibility_km": 10.0,
        "observed_at": "2026-09-12T06:00:00Z",
        "valid_to": "2026-09-12T18:00:00Z",
    }
    payload_w = ImdWeatherNormalizer.normalize(raw_weather)
    assert payload_w.harbor == "Ratnagiri"
    assert payload_w.wind_speed_knots == 15.0
    assert payload_w.wind_gust_knots is None
    assert payload_w.wind_direction_deg == 230.0
    assert "IMD Coastal Weather Bulletin (SYNTHETIC)" in payload_w.source_name

    raw_hazard = {
        "bulletin_id": "IMD-CWB-2026-09-12-01",
        "severity": "WARNING",
        "event_type": "SQUALLY_WEATHER",
        "headline": "Squally weather with wind speed 45-55 kmph",
        "valid_from": "2026-09-12T04:00:00Z",
        "valid_to": "2026-09-12T16:00:00Z",
        "status": "ACTIVE",
    }
    payload_h = ImdHazardNormalizer.normalize(raw_hazard)
    assert payload_h.severity == "WARNING"
    assert payload_h.squall_alert is True
    assert payload_h.bulletin_id == "IMD-CWB-2026-09-12-01"
    assert "IMD Cyclone Warning Division (SYNTHETIC)" in payload_h.source_name


def test_mosdac_eo_normalizer():
    """Verify MOSDAC Earth Observation normalizer with QA_FLAGS and missing handling."""
    raw_eo = {
        "cell_id": "CELL-02-02",
        "latitude": 16.5,
        "longitude": 73.0,
        "observation_time": "2026-09-12T06:00:00Z",
        "sst_c": 28.5,
        "chlorophyll_mg_m3": 1.45,
        "uncertainty": 0.12,
        "QA_FLAGS": 0,
        "qc_status": "VALID",
    }
    norm_eo = MosdacEONormalizer.normalize(raw_eo)
    assert norm_eo["cell_id"] == "CELL-02-02"
    assert norm_eo["sst_c"] == 28.5
    assert norm_eo["chlorophyll_mg_m3"] == 1.45
    assert "MOSDAC / ISRO" in norm_eo["source_name"]


# ---------------------------------------------------------------------------
# 3. Referential Integrity & No Orphans Test
# ---------------------------------------------------------------------------
def test_referential_integrity():
    """Verify that all foreign key references in synthetic dataset resolve to valid parents."""
    dataset = generate_synthetic_demo_dataset()

    harbor_ids = {h["public_id"] for h in dataset["harbors"]}
    fisher_ids = {f["public_id"] for f in dataset["fishers"]}
    vessel_ids = {v["public_id"] for v in dataset["vessels"]}
    node_ids = {n["public_id"] for n in dataset["route_nodes"]}
    hazard_ids = {h["public_id"] for h in dataset["hazards"]}
    geofence_ids = {g["public_id"] for g in dataset["geofences"]}
    trip_ids = {t["public_id"] for t in dataset["trips"]}

    # Fishers -> Harbors
    for f in dataset["fishers"]:
        assert f["home_harbor_id"] in harbor_ids

    # Vessels -> Fishers & Harbors
    for v in dataset["vessels"]:
        assert v["owner_fisher_id"] in fisher_ids
        assert v["home_harbor_id"] in harbor_ids

    # Trips -> Fishers, Vessels, Harbors
    for t in dataset["trips"]:
        assert t["fisher_id"] in fisher_ids
        assert t["vessel_id"] in vessel_ids
        assert t["origin_harbor_id"] in harbor_ids

    # Marine Observations -> Harbors
    for obs in dataset["marine_observations"]:
        assert obs["harbor_id"] in harbor_ids

    # Route Edges -> Route Nodes
    for e in dataset["route_edges"]:
        assert e["from_node_id"] in node_ids
        assert e["to_node_id"] in node_ids

    # Notifications -> Fishers, Vessels, Trips, Hazards, Geofences
    for n in dataset["notifications"]:
        if n["fisher_id"]:
            assert n["fisher_id"] in fisher_ids
        if n["vessel_id"]:
            assert n["vessel_id"] in vessel_ids
        if n["trip_id"]:
            assert n["trip_id"] in trip_ids
        if n["hazard_id"]:
            assert n["hazard_id"] in hazard_ids
        if n["geofence_id"]:
            assert n["geofence_id"] in geofence_ids

    # Replay Positions -> Vessels & Trips
    for rp in dataset["replay_positions"]:
        assert rp["vessel_id"] in vessel_ids
        if rp["trip_id"]:
            assert rp["trip_id"] in trip_ids


# ---------------------------------------------------------------------------
# 4. Quality and Edge Cases Tests
# ---------------------------------------------------------------------------
def test_quality_and_edge_cases():
    """Verify presence of missing!=0, stale!=current, degraded QC, and expired/distant PFZs."""
    dataset = generate_synthetic_demo_dataset()

    # 1. Missing Data != 0
    missing_gust_count = sum(1 for o in dataset["marine_observations"] if o["wind_gust_knots"] is None)
    assert missing_gust_count > 0, "Expected some marine observations to have missing gust readings (None, not 0)"

    # 2. Stale Data != Current
    stale_count = sum(1 for o in dataset["marine_observations"] if o["is_stale"] is True)
    assert stale_count > 0, "Expected some marine observations to be flagged as is_stale=True"

    # 3. Degraded Quality Observations
    degraded_obs = [o for o in dataset["marine_observations"] if "DEGRADED" in o["qc_status"]]
    assert len(degraded_obs) > 0, "Expected degraded QC status marine observations"

    # 4. Cloud Obscured Satellite Cells
    obscured_cells = [c for c in dataset["eo_grid_cells"] if c["qc_status"] == "CLOUD_OBSCURED"]
    assert len(obscured_cells) > 0, "Expected cloud-obscured EO grid cells"
    for c in obscured_cells:
        assert c["cloud_fraction"] > 0.5
        assert c["sst_c"] is None

    # 5. Expired PFZ Candidates
    expired_pfz = [p for p in dataset["pfz_candidates"] if p["qc_status"] == "EXPIRED"]
    assert len(expired_pfz) > 0, "Expected expired PFZ candidates"
    for p in expired_pfz:
        assert p["valid_to"] < REFERENCE_TIME

    # 6. Out-of-radius PFZ Candidates
    distant_pfz = [p for p in dataset["pfz_candidates"] if p["distance_km"] > 30.0]
    assert len(distant_pfz) > 0, "Expected out-of-radius PFZ candidates (> 30 km)"

    # 7. Active Hazard Events
    active_hazards = [h for h in dataset["hazards"] if h["status"] == "ACTIVE"]
    assert len(active_hazards) > 0, "Expected active marine hazard events"


# ---------------------------------------------------------------------------
# 5. Spatial & Topological Validity Tests (Shapely)
# ---------------------------------------------------------------------------
def test_spatial_validity():
    """Verify all geometries and coordinate boundaries using Shapely."""
    dataset = generate_synthetic_demo_dataset()
    val_report = validate_synthetic_dataset(dataset)

    assert val_report["status"] == "VALID"
    assert val_report["geometries_validated"] == 15  # 5 geofences + 10 hazards
    assert val_report["coordinates_validated"] > 400

    # Geofences geometry check
    for gf in dataset["geofences"]:
        geom = shape(gf["geometry_geojson"])
        assert geom.is_valid
        assert not geom.is_empty
        assert geom.geom_type in ("Polygon", "MultiPolygon")

    # Hazard events geometry check
    for hz in dataset["hazards"]:
        geom = shape(hz["geometry_geojson"])
        assert geom.is_valid
        assert not geom.is_empty


# ---------------------------------------------------------------------------
# 6. Seeder Database Upsert, Reset, and Idempotency Tests
# ---------------------------------------------------------------------------
def test_seeder_db_lifecycle(sqlite_session):
    """Test full database lifecycle: initial seed, idempotency, and isolated reset."""
    repo = SyntheticDemoRepository(sqlite_session)

    # 1. Initial Seed
    res1 = seed_synthetic_demo(session=sqlite_session, reset_first=False, dry_run=False)
    assert res1["status"] == "SUCCESS"
    assert res1["seeded_counts"]["stakeholders"] == 5
    assert res1["seeded_counts"]["marine_observations"] == 96

    counts1 = repo.get_counts_by_namespace(SYNTHETIC_NAMESPACE)
    assert counts1["stakeholders"] == 5
    assert counts1["vessels"] == 8
    assert counts1["eo_grid_cells"] == 350

    # 2. Idempotent Second Seed (no duplicates)
    res2 = seed_synthetic_demo(session=sqlite_session, reset_first=False, dry_run=False)
    assert res2["status"] == "SUCCESS"
    counts2 = repo.get_counts_by_namespace(SYNTHETIC_NAMESPACE)
    assert counts2 == counts1, "Repeated seeding must not duplicate records"

    # 3. Seed into a separate namespace
    custom_ns = "CUSTOM_TEST_NS"
    seed_synthetic_demo(session=sqlite_session, namespace=custom_ns)
    custom_counts = repo.get_counts_by_namespace(custom_ns)
    assert custom_counts["stakeholders"] == 5

    # 4. Reset only the default namespace
    reset_res = reset_synthetic_demo(session=sqlite_session, namespace=SYNTHETIC_NAMESPACE)
    assert reset_res["stakeholders"] == 5
    after_reset_counts = repo.get_counts_by_namespace(SYNTHETIC_NAMESPACE)
    assert sum(after_reset_counts.values()) == 0

    # Verify custom namespace is preserved
    preserved_counts = repo.get_counts_by_namespace(custom_ns)
    assert preserved_counts["stakeholders"] == 5


# ---------------------------------------------------------------------------
# 7. Repository Query Method Tests
# ---------------------------------------------------------------------------
def test_repository_query_helpers(sqlite_session):
    """Test specialized query helper methods on SyntheticDemoRepository."""
    seed_synthetic_demo(session=sqlite_session)
    repo = SyntheticDemoRepository(sqlite_session)

    # Marine observations by harbor
    ratnagiri_obs = repo.get_marine_observations(harbor_id="harbor-ratnagiri")
    assert len(ratnagiri_obs) == 48
    assert all(o.harbor_id == "harbor-ratnagiri" for o in ratnagiri_obs)

    # PFZ candidates valid filter
    valid_pfz = repo.get_pfz_candidates(valid_only=True, as_of=REFERENCE_TIME)
    assert len(valid_pfz) < 12  # Filters out expired ones
    assert all(p.qc_status == "VALID" for p in valid_pfz)

    # Hazards by status
    active_hz = repo.get_hazards(status="ACTIVE")
    assert len(active_hz) > 0
    assert all(h.status == "ACTIVE" for h in active_hz)

    # Vessel replay
    track = repo.get_vessel_replay(vessel_id="vessel-01")
    assert len(track) == 30
    assert all(p.vessel_id == "vessel-01" for p in track)


# ---------------------------------------------------------------------------
# 8. DataService Synthetic Handler Tests
# ---------------------------------------------------------------------------
def test_data_service_synthetic_routing():
    """Verify that DataService returns synthetic demo records when mode is SYNTHETIC."""
    service = DataService(data_mode="SYNTHETIC")

    marine_data = service._get_synthetic_marine(lat=16.99, lon=73.28)
    assert marine_data["mode"] == "SYNTHETIC"
    assert marine_data["data_source"] == "INCOIS-OSF"
    assert "hourly_forecast" in marine_data
    assert len(marine_data["hourly_forecast"]) == 48

    weather_data = service._get_synthetic_weather(lat=16.99, lon=73.28)
    assert weather_data["mode"] == "SYNTHETIC"
    assert weather_data["data_source"] == "IMD"
    assert "current" in weather_data

    hazard_data = service._get_synthetic_hazard(lat=16.99, lon=73.28)
    assert hazard_data["mode"] == "SYNTHETIC"
    assert hazard_data["data_source"] == "IMD-Hazard-Bulletin"
    assert "advisories" in hazard_data

    pfz_data = service._get_synthetic_pfz(lat=16.99, lon=73.28)
    assert pfz_data["mode"] == "SYNTHETIC"
    assert pfz_data["data_source"] == "INCOIS-PFZ"
    assert "candidates" in pfz_data


# ---------------------------------------------------------------------------
# 9. FastAPI REST Demo Endpoints Tests
# ---------------------------------------------------------------------------
def test_demo_api_endpoints(sqlite_session):
    """Verify REST endpoints under /api/v1/demo/* using FastAPI TestClient."""
    # Seed the session
    seed_synthetic_demo(session=sqlite_session)

    # Context manager factory returning sqlite_session
    class SessionContext:
        def __enter__(self):
            return sqlite_session

        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("backend.app.api.v1.routes.SessionLocal", side_effect=SessionContext):
        with TestClient(app) as test_client:
            # 1. Manifest
            res = test_client.get("/api/v1/demo/manifest")
            assert res.status_code == 200
            data = res.json()
            assert data["dataset_name"] == "SAMUDRA_DEMO_V1"

            # 2. Stakeholders
            res = test_client.get("/api/v1/demo/stakeholders")
            assert res.status_code == 200
            assert len(res.json()) == 5

            # 3. Harbors
            res = test_client.get("/api/v1/demo/harbors")
            assert res.status_code == 200
            assert len(res.json()) == 2

            # 4. Fishers
            res = test_client.get("/api/v1/demo/fishers")
            assert res.status_code == 200
            assert len(res.json()) == 8

            # 5. Vessels
            res = test_client.get("/api/v1/demo/vessels")
            assert res.status_code == 200
            assert len(res.json()) == 8

            # 6. Trips
            res = test_client.get("/api/v1/demo/trips")
            assert res.status_code == 200
            assert len(res.json()) == 12

            # 7. Marine observations
            res = test_client.get("/api/v1/demo/marine-observations?harbor_id=harbor-ratnagiri")
            assert res.status_code == 200
            assert len(res.json()) == 48

            # 8. EO grid cells
            res = test_client.get("/api/v1/demo/eo-grid-cells?cell_id=CELL-00-00")
            assert res.status_code == 200
            assert len(res.json()) == 14

            # 9. PFZ candidates
            res = test_client.get("/api/v1/demo/pfz-candidates")
            assert res.status_code == 200
            assert len(res.json()) == 12

            # 10. Geofences
            res = test_client.get("/api/v1/demo/geofences")
            assert res.status_code == 200
            assert len(res.json()) == 5

            # 11. Routes
            res = test_client.get("/api/v1/demo/routes")
            assert res.status_code == 200
            routes_data = res.json()
            assert len(routes_data["nodes"]) == 24
            assert len(routes_data["edges"]) == 32

            # 12. Hazards
            res = test_client.get("/api/v1/demo/hazards")
            assert res.status_code == 200
            assert len(res.json()) == 10

            # 13. Notifications
            res = test_client.get("/api/v1/demo/notifications")
            assert res.status_code == 200
            assert len(res.json()) == 20

            # 14. Vessel replay
            res = test_client.get("/api/v1/demo/vessels/vessel-01/replay")
            assert res.status_code == 200
            assert len(res.json()) == 30
