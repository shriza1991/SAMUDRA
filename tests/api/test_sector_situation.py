"""Focused tests for Authority Sector Situation / Risk.

Verifies:
1. Sector situation endpoint returns the correct canonical sector.
2. Ratnagiri returns dynamic fleet_count = 4.
3. Malvan returns dynamic fleet_count = 4.
4. Goa returns dynamic fleet_count = 2.
5. Mumbai returns dynamic fleet_count = 2.
6. Veraval returns dynamic fleet_count = 2.
7. Unknown sector returns 404.
8. Situation status comes from the deterministic risk engine.
9. Risk engine receives canonical ObservationBundle.
10. Missing critical marine data does not produce GO (produces UNKNOWN).
11. Stale critical data does not produce GO (produces UNKNOWN).
12. Degraded critical data does not produce GO (produces UNKNOWN).
13. Existing GO scenario remains GO when calm evidence is present.
14. Existing CAUTION scenario remains CAUTION.
15. Existing NO_GO scenario remains NO_GO.
16. Evidence and provenance remain attached to the situation result.
17. Sector situation does not cross-aggregate vessels or hazards from another sector.
"""

from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
import pytest

from backend.app.main import app
from backend.app.agents.integrations.dev2 import (
    HazardBulletinPayload,
    MarineConditionsPayload,
    WeatherConditionsPayload,
)
from backend.app.contracts.chat import RecommendationStatus
from backend.app.contracts.observation import ObservationBundle
from backend.app.domain.situation import evaluate_sector_situation

client = TestClient(app)


def test_1_sector_situation_returns_canonical_sector():
    """Verify endpoint resolves canonical sector metadata and returns 200 OK."""
    res = client.get("/api/v1/demo/sectors/sector-ratnagiri/situation")
    assert res.status_code == 200
    data = res.json()
    assert data["sector_id"] == "sector-ratnagiri"
    assert "Ratnagiri" in data["sector_name"]
    assert data["harbor_id"] == "harbor-ratnagiri"
    assert data["harbor_name"] == "Ratnagiri"
    assert "situation_status" in data
    assert "fleet_count" in data
    assert "active_hazard_count" in data


def test_2_ratnagiri_dynamic_fleet_count():
    """Ratnagiri vessels dynamically queried from canonical records (vessel-01..vessel-04 = 4)."""
    res = client.get("/api/v1/demo/sectors/sector-ratnagiri/situation")
    assert res.status_code == 200
    assert res.json()["fleet_count"] == 4


def test_3_malvan_dynamic_fleet_count():
    """Malvan vessels dynamically queried from canonical records (vessel-05..vessel-08 = 4)."""
    res = client.get("/api/v1/demo/sectors/sector-malvan/situation")
    assert res.status_code == 200
    assert res.json()["fleet_count"] == 4


def test_4_goa_dynamic_fleet_count():
    """Goa vessels dynamically queried from canonical records (vessel-09..vessel-10 = 2)."""
    res = client.get("/api/v1/demo/sectors/sector-goa/situation")
    assert res.status_code == 200
    assert res.json()["fleet_count"] == 2


def test_5_mumbai_dynamic_fleet_count():
    """Mumbai vessels dynamically queried from canonical records (vessel-11..vessel-12 = 2)."""
    res = client.get("/api/v1/demo/sectors/sector-mumbai/situation")
    assert res.status_code == 200
    assert res.json()["fleet_count"] == 2


def test_6_veraval_dynamic_fleet_count():
    """Veraval vessels dynamically queried from canonical records (vessel-13..vessel-14 = 2)."""
    res = client.get("/api/v1/demo/sectors/sector-veraval/situation")
    assert res.status_code == 200
    assert res.json()["fleet_count"] == 2


def test_7_unknown_sector_returns_404():
    """Unrecognized sector ID must return 404 rather than defaulting or failing silently."""
    res = client.get("/api/v1/demo/sectors/unknown-sector-99/situation")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_8_situation_status_from_deterministic_risk_engine():
    """Situation status must be a valid RecommendationStatus enum value (GO, CAUTION, NO_GO, UNKNOWN)."""
    res = client.get("/api/v1/demo/sectors/sector-ratnagiri/situation")
    assert res.status_code == 200
    status_val = res.json()["situation_status"]
    assert status_val in ["GO", "CAUTION", "NO_GO", "UNKNOWN"]
    assert res.json()["recommendation"]["status"] == status_val


def test_9_risk_engine_receives_canonical_observation_bundle():
    """Direct evaluation accepts ObservationBundle and drives the decision."""
    now_iso = datetime.now(timezone.utc).isoformat()
    future_iso = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    bundle = ObservationBundle(
        marine=MarineConditionsPayload(
            harbor="Ratnagiri",
            significant_wave_height_m=1.1,
            swell_height_m=0.7,
            swell_period_sec=8.0,
            surface_current_knots=0.8,
            sea_surface_temp_c=28.0,
            observed_at=now_iso,
            valid_to=future_iso,
            source_name="INCOIS OSF Test",
        ),
        weather=WeatherConditionsPayload(
            harbor="Ratnagiri",
            wind_speed_knots=10.0,
            wind_gust_knots=14.0,
            wind_direction_deg=220.0,
            visibility_km=10.0,
            observed_at=now_iso,
            valid_to=future_iso,
            source_name="IMD AWS Test",
        ),
        hazard=HazardBulletinPayload(
            bulletin_id="HAZ-TEST-01",
            severity="NORMAL",
            headline="Calm sea conditions",
            cyclone_warning_active=False,
            squall_alert=False,
            valid_from=now_iso,
            valid_to=future_iso,
            source_name="IMD Hazard Test",
        ),
    )

    situation = evaluate_sector_situation("sector-ratnagiri", bundle=bundle)
    assert situation is not None
    assert situation.situation_status == RecommendationStatus.GO
    assert situation.recommendation.status == RecommendationStatus.GO


def test_10_missing_critical_marine_data_is_unknown_not_go():
    """CRITICAL SAFETY RULE: Missing significant wave height must NOT produce GO (must produce UNKNOWN)."""
    now_iso = datetime.now(timezone.utc).isoformat()
    future_iso = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    bundle = ObservationBundle(
        marine=MarineConditionsPayload(
            harbor="Ratnagiri",
            significant_wave_height_m=None,  # MISSING CRITICAL SWH
            observed_at=now_iso,
            valid_to=future_iso,
            source_name="INCOIS OSF Incomplete",
        ),
        weather=WeatherConditionsPayload(
            harbor="Ratnagiri",
            wind_speed_knots=8.0,
            observed_at=now_iso,
            valid_to=future_iso,
            source_name="IMD AWS",
        ),
        hazard=HazardBulletinPayload(
            bulletin_id="HAZ-TEST-02",
            severity="NORMAL",
            headline="Normal",
            cyclone_warning_active=False,
            squall_alert=False,
            valid_from=now_iso,
            valid_to=future_iso,
            source_name="IMD Hazard",
        ),
    )

    situation = evaluate_sector_situation("sector-ratnagiri", bundle=bundle)
    assert situation is not None
    assert situation.situation_status == RecommendationStatus.UNKNOWN
    assert situation.situation_status != RecommendationStatus.GO


def test_11_stale_critical_data_is_unknown_not_go():
    """CRITICAL SAFETY RULE: Expired valid_to window must NOT produce GO (must produce UNKNOWN)."""
    now = datetime.now(timezone.utc)
    expired_time = (now - timedelta(hours=2)).isoformat()
    old_obs = (now - timedelta(hours=8)).isoformat()

    bundle = ObservationBundle(
        marine=MarineConditionsPayload(
            harbor="Ratnagiri",
            significant_wave_height_m=1.0,
            observed_at=old_obs,
            valid_to=expired_time,  # EXPIRED
            source_name="INCOIS OSF Stale",
        ),
        weather=WeatherConditionsPayload(
            harbor="Ratnagiri",
            wind_speed_knots=9.0,
            observed_at=old_obs,
            valid_to=expired_time,  # EXPIRED
            source_name="IMD AWS Stale",
        ),
        hazard=HazardBulletinPayload(
            bulletin_id="HAZ-TEST-03",
            severity="NORMAL",
            headline="Normal",
            cyclone_warning_active=False,
            squall_alert=False,
            valid_from=old_obs,
            valid_to=expired_time,  # EXPIRED
            source_name="IMD Hazard Stale",
        ),
    )

    situation = evaluate_sector_situation("sector-ratnagiri", bundle=bundle)
    assert situation is not None
    assert situation.situation_status == RecommendationStatus.UNKNOWN
    assert situation.situation_status != RecommendationStatus.GO


def test_12_degraded_critical_source_is_unknown_not_go():
    """CRITICAL SAFETY RULE: Degraded source indicator must NOT produce GO (must produce UNKNOWN)."""
    now_iso = datetime.now(timezone.utc).isoformat()
    future_iso = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    bundle = ObservationBundle(
        marine=MarineConditionsPayload(
            harbor="Ratnagiri",
            significant_wave_height_m=1.1,
            observed_at=now_iso,
            valid_to=future_iso,
            source_name="INCOIS DEGRADED FALLBACK",  # DEGRADED
        ),
        weather=WeatherConditionsPayload(
            harbor="Ratnagiri",
            wind_speed_knots=10.0,
            observed_at=now_iso,
            valid_to=future_iso,
            source_name="IMD AWS",
        ),
        hazard=HazardBulletinPayload(
            bulletin_id="HAZ-TEST-04",
            severity="NORMAL",
            headline="Normal",
            cyclone_warning_active=False,
            squall_alert=False,
            valid_from=now_iso,
            valid_to=future_iso,
            source_name="IMD Hazard",
        ),
    )

    situation = evaluate_sector_situation("sector-ratnagiri", bundle=bundle)
    assert situation is not None
    assert situation.situation_status == RecommendationStatus.UNKNOWN
    assert situation.situation_status != RecommendationStatus.GO


def test_13_existing_go_scenario_remains_go():
    """Calm valid conditions evaluate deterministically to GO."""
    now_iso = datetime.now(timezone.utc).isoformat()
    future_iso = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    bundle = ObservationBundle(
        marine=MarineConditionsPayload(
            harbor="Ratnagiri",
            significant_wave_height_m=0.9,
            swell_height_m=0.5,
            swell_period_sec=7.0,
            surface_current_knots=0.6,
            sea_surface_temp_c=28.0,
            observed_at=now_iso,
            valid_to=future_iso,
            source_name="INCOIS OSF",
        ),
        weather=WeatherConditionsPayload(
            harbor="Ratnagiri",
            wind_speed_knots=8.0,
            wind_gust_knots=12.0,
            wind_direction_deg=210.0,
            visibility_km=12.0,
            observed_at=now_iso,
            valid_to=future_iso,
            source_name="IMD AWS",
        ),
        hazard=HazardBulletinPayload(
            bulletin_id="HAZ-TEST-05",
            severity="NORMAL",
            headline="No warnings",
            cyclone_warning_active=False,
            squall_alert=False,
            valid_from=now_iso,
            valid_to=future_iso,
            source_name="IMD Hazard",
        ),
    )

    situation = evaluate_sector_situation("sector-ratnagiri", bundle=bundle)
    assert situation is not None
    assert situation.situation_status == RecommendationStatus.GO


def test_14_existing_caution_scenario_remains_caution():
    """Elevated wave height / gusts evaluate deterministically to CAUTION."""
    now_iso = datetime.now(timezone.utc).isoformat()
    future_iso = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    bundle = ObservationBundle(
        marine=MarineConditionsPayload(
            harbor="Ratnagiri",
            significant_wave_height_m=1.7,  # > 1.5m caution trigger for motorized_boat
            swell_height_m=1.1,
            swell_period_sec=8.5,
            surface_current_knots=1.1,
            sea_surface_temp_c=27.8,
            observed_at=now_iso,
            valid_to=future_iso,
            source_name="INCOIS OSF",
        ),
        weather=WeatherConditionsPayload(
            harbor="Ratnagiri",
            wind_speed_knots=14.0,
            wind_gust_knots=18.0,
            wind_direction_deg=230.0,
            visibility_km=9.0,
            observed_at=now_iso,
            valid_to=future_iso,
            source_name="IMD AWS",
        ),
        hazard=HazardBulletinPayload(
            bulletin_id="HAZ-TEST-06",
            severity="WATCH",
            headline="Coastal weather watch",
            cyclone_warning_active=False,
            squall_alert=False,
            valid_from=now_iso,
            valid_to=future_iso,
            source_name="IMD Hazard",
        ),
    )

    situation = evaluate_sector_situation("sector-ratnagiri", bundle=bundle)
    assert situation is not None
    assert situation.situation_status == RecommendationStatus.CAUTION


def test_15_existing_no_go_scenario_remains_no_go():
    """Severe conditions (e.g. active cyclone warning or wave height > 2.0m) evaluate to NO_GO."""
    now_iso = datetime.now(timezone.utc).isoformat()
    future_iso = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    bundle = ObservationBundle(
        marine=MarineConditionsPayload(
            harbor="Ratnagiri",
            significant_wave_height_m=2.6,  # > 2.0m ceiling for motorized_boat
            swell_height_m=1.8,
            swell_period_sec=10.0,
            surface_current_knots=1.8,
            sea_surface_temp_c=27.0,
            observed_at=now_iso,
            valid_to=future_iso,
            source_name="INCOIS OSF",
        ),
        weather=WeatherConditionsPayload(
            harbor="Ratnagiri",
            wind_speed_knots=26.0,  # > 25 knots ceiling
            wind_gust_knots=34.0,
            wind_direction_deg=250.0,
            visibility_km=4.0,
            observed_at=now_iso,
            valid_to=future_iso,
            source_name="IMD AWS",
        ),
        hazard=HazardBulletinPayload(
            bulletin_id="HAZ-TEST-07",
            severity="WARNING",
            headline="Severe Cyclonic Storm Warning",
            cyclone_warning_active=True,
            squall_alert=True,
            valid_from=now_iso,
            valid_to=future_iso,
            source_name="IMD Cyclone Warning Division",
        ),
    )

    situation = evaluate_sector_situation("sector-ratnagiri", bundle=bundle)
    assert situation is not None
    assert situation.situation_status == RecommendationStatus.NO_GO


def test_16_evidence_and_provenance_attached():
    """Ground-truth evidence and provenance must remain attached to situation result."""
    res = client.get("/api/v1/demo/sectors/sector-ratnagiri/situation")
    assert res.status_code == 200
    data = res.json()
    assert "evidence" in data
    assert len(data["evidence"]) >= 2
    assert "recommendation" in data
    assert "provenance" in data["recommendation"]
    assert len(data["recommendation"]["provenance"]) >= 1


def test_17_sectors_do_not_cross_aggregate_vessels_or_hazards():
    """Different sectors return their own discrete fleet and hazard counts."""
    res_ratnagiri = client.get("/api/v1/demo/sectors/sector-ratnagiri/situation")
    res_goa = client.get("/api/v1/demo/sectors/sector-goa/situation")
    res_veraval = client.get("/api/v1/demo/sectors/sector-veraval/situation")

    assert res_ratnagiri.status_code == 200
    assert res_goa.status_code == 200
    assert res_veraval.status_code == 200

    data_r = res_ratnagiri.json()
    data_g = res_goa.json()
    data_v = res_veraval.json()

    assert data_r["fleet_count"] == 4
    assert data_g["fleet_count"] == 2
    assert data_v["fleet_count"] == 2

    assert data_r["harbor_id"] == "harbor-ratnagiri"
    assert data_g["harbor_id"] == "harbor-panaji"
    assert data_v["harbor_id"] == "harbor-veraval"
