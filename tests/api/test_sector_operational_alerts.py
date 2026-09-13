"""P0-8C current operational alerts derived from P0-8B associations."""

import pytest
from fastapi import HTTPException

from backend.app.api.v1.routes import (
    get_demo_sector_hazard_associations,
    get_demo_sector_operational_alerts,
)
from backend.app.domain.situation import get_canonical_active_hazards_for_sector


def test_alerts_are_stable_association_derived_and_hazard_severity_backed():
    sector_id = "sector-ratnagiri"
    alerts = get_demo_sector_operational_alerts(sector_id)
    rerun = get_demo_sector_operational_alerts(sector_id)
    associations = get_demo_sector_hazard_associations(sector_id)
    severities = {hazard["public_id"]: hazard["severity"] for hazard in get_canonical_active_hazards_for_sector(sector_id) or []}

    assert [alert.alert_id for alert in alerts.alerts] == [alert.alert_id for alert in rerun.alerts]
    assert {(alert.vessel_id, alert.hazard_id) for alert in alerts.alerts} == {
        (association.vessel_id, association.hazard_id) for association in associations.associations
    }
    assert all(alert.severity == severities[alert.hazard_id] for alert in alerts.alerts)
    assert all(alert.status == "ACTIVE" for alert in alerts.alerts)


@pytest.mark.parametrize("sector_id", ["sector-malvan", "sector-mumbai", "sector-veraval"])
def test_zero_current_associations_returns_empty_alerts(sector_id):
    assert get_demo_sector_operational_alerts(sector_id).alerts == []


def test_invalid_sector_is_not_defaulted():
    with pytest.raises(HTTPException) as exc_info:
        get_demo_sector_operational_alerts("sector-not-real")
    assert exc_info.value.status_code == 404
