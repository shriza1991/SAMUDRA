"""P0-8B observational vessel-in-hazard-area tests."""

import pytest
from fastapi import HTTPException

from backend.app.api.v1.routes import get_demo_sector_hazard_associations


def test_associations_are_sector_scoped_and_observational():
    ratnagiri = get_demo_sector_hazard_associations("sector-ratnagiri")
    goa = get_demo_sector_hazard_associations("sector-goa")
    assert all(item.sector_id == "sector-ratnagiri" for item in ratnagiri.associations)
    assert all(item.vessel_id in {"vessel-01", "vessel-02", "vessel-03", "vessel-04"} for item in ratnagiri.associations)
    assert all(item.association_type == "IN_HAZARD_AREA" for item in ratnagiri.associations)
    assert all(item.sector_id == "sector-goa" for item in goa.associations)
    assert all(item.vessel_id in {"vessel-09", "vessel-10"} for item in goa.associations)


def test_zero_associations_and_invalid_sector_are_not_fallbacks():
    assert get_demo_sector_hazard_associations("sector-veraval").associations == []
    with pytest.raises(HTTPException) as exc_info:
        get_demo_sector_hazard_associations("sector-not-real")
    assert exc_info.value.status_code == 404
