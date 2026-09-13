"""P0-8A canonical Authority sector-hazard endpoint tests."""

import pytest
from fastapi import HTTPException

from backend.app.api.v1.routes import get_demo_sector_hazards
from backend.app.domain.synthetic.generator import generate_synthetic_demo_dataset


@pytest.mark.parametrize(
    ("sector_id", "expected_ids"),
    [
        ("sector-ratnagiri", {"hazard-01", "hazard-02", "hazard-05"}),
        ("sector-goa", {"hazard-03"}),
        ("sector-mumbai", set()),
        ("sector-veraval", set()),
    ],
)
def test_sector_endpoint_returns_only_canonical_active_hazards(sector_id, expected_ids):
    response = get_demo_sector_hazards(sector_id)
    assert response.sector_id == sector_id
    assert {hazard.hazard_id for hazard in response.hazards} == expected_ids
    assert all(hazard.status == "ACTIVE" for hazard in response.hazards)


def test_expired_and_future_hazards_are_not_returned_as_active():
    returned_ids = {
        hazard.hazard_id
        for sector_id in ("sector-ratnagiri", "sector-goa", "sector-malvan", "sector-mumbai", "sector-veraval")
        for hazard in get_demo_sector_hazards(sector_id).hazards
    }
    assert {"hazard-04", "hazard-06", "hazard-07", "hazard-08", "hazard-10"}.isdisjoint(returned_ids)


def test_invalid_sector_is_rejected_without_a_ratnagiri_fallback():
    with pytest.raises(HTTPException) as exc_info:
        get_demo_sector_hazards("sector-not-real")
    assert exc_info.value.status_code == 404


def test_returned_geometry_is_the_canonical_hazard_geometry():
    generated = {item["public_id"]: item for item in generate_synthetic_demo_dataset()["hazards"]}
    for hazard in get_demo_sector_hazards("sector-ratnagiri").hazards:
        assert hazard.geometry == generated[hazard.hazard_id]["geometry_geojson"]
        assert hazard.geometry["type"] in {"Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon"}

