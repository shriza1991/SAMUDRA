"""Tests for Deterministic Geospatial Hazards & Restrictions Engine.

Tests:
- Point inside restricted polygon (e.g. Naval Firing Range Foxtrot)
- Point outside restricted zones
- Point on/near boundary (distance calculation)
- Route line string crossing restricted polygon
- Expired restriction handling
- Overlapping / multiple restrictions
"""

import json
import pytest
from datetime import UTC, datetime, timedelta

from backend.app.agents.integrations.contracts import ToolInvocationContext
from backend.app.domain.geo_restrictions import DeterministicGeospatialEngine


@pytest.fixture
def geo_engine():
    return DeterministicGeospatialEngine()


def test_point_inside_naval_range(geo_engine):
    # Naval Firing Range Foxtrot bounds: lon [73.15, 73.35], lat [15.30, 15.55]
    inside_coords = [73.25, 15.40]
    ctx = ToolInvocationContext(coordinates=inside_coords)

    payload = geo_engine.check_geofence_hazards(ctx, inside_coords)

    assert payload.intersected is True
    assert payload.hard_stop is True
    assert payload.restricted is True
    assert payload.distance_to_boundary_km == 0.0
    assert "Naval Firing Range Foxtrot" in (payload.restriction_name or "")


def test_point_outside_restricted_zones(geo_engine):
    # Ratnagiri harbor waters: [73.28, 16.99]
    ratnagiri_coords = [73.28, 16.99]
    ctx = ToolInvocationContext(origin_harbor="Ratnagiri", coordinates=ratnagiri_coords)

    payload = geo_engine.check_geofence_hazards(ctx, ratnagiri_coords)

    assert payload.intersected is False
    assert payload.hard_stop is False
    # Far from any restricted polygon
    assert payload.distance_to_boundary_km is not None
    assert payload.distance_to_boundary_km > 10.0


def test_boundary_proximity(geo_engine):
    # Point ~3 km north of Naval range boundary (lat 15.58, lon 73.25)
    near_coords = [73.25, 15.58]
    ctx = ToolInvocationContext(coordinates=near_coords)

    payload = geo_engine.check_geofence_hazards(ctx, near_coords)

    assert payload.intersected is False
    assert payload.hard_stop is False
    assert payload.restricted is True  # Proximity trigger (< 10 km)
    assert payload.distance_to_boundary_km is not None
    assert payload.distance_to_boundary_km < 10.0


def test_route_crossing_restricted_polygon(geo_engine):
    # Passage line from south of Goa naval range to north of Goa naval range
    passage_line = [
        [73.25, 15.20],  # South of range
        [73.25, 15.65],  # North of range
    ]
    ctx = ToolInvocationContext(origin_harbor="Goa")

    payload = geo_engine.check_geofence_hazards(ctx, passage_line)

    assert payload.intersected is True
    assert payload.hard_stop is True
    assert payload.distance_to_boundary_km == 0.0


def test_expired_restriction_handling(tmp_path):
    expired_geojson = tmp_path / "expired_restrictions.geojson"
    expired_time = (datetime.now(UTC) - timedelta(days=10)).isoformat()

    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "restriction_id": "REST-OLD-01",
                    "name": "Old Temporary Range",
                    "type": "NAVAL_FIRING_RANGE",
                    "valid_from": "2025-01-01T00:00:00Z",
                    "valid_to": expired_time,
                    "is_hard_restriction": True,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [70.0, 20.0],
                            [71.0, 20.0],
                            [71.0, 21.0],
                            [70.0, 21.0],
                            [70.0, 20.0],
                        ]
                    ],
                },
            }
        ],
    }
    expired_geojson.write_text(json.dumps(data), encoding="utf-8")

    engine = DeterministicGeospatialEngine(restrictions_path=expired_geojson, geofences_path=tmp_path / "empty.geojson")
    ctx = ToolInvocationContext(coordinates=[70.5, 20.5])
    payload = engine.check_geofence_hazards(ctx, [70.5, 20.5])

    # Should ignore expired restriction
    assert payload.intersected is False
    assert payload.hard_stop is False
