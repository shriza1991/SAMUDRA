"""Tests for Deterministic Map Layer Generator (backend/app/domain/map_layers.py).

Owned by Dev 4 (Marine, Geo, Risk & Route Intelligence) & Dev 2 (Platform Contracts).
Validates:
1. Selective layer generation per query intent (no forcing all 9 layers).
2. Pure transformation without recomputing domain logic or altering risk status.
3. Canonical GeoJSON structure and EPSG:4326 coordinate compliance.
4. Correct categorization (safety_critical vs navigation).
5. Accurate rendering of PFZ, routes, hazards, geofences, and safety envelopes.
"""

from __future__ import annotations

import pytest

from backend.app.contracts.chat import (
    MapLayer,
    Recommendation,
    RecommendationStatus,
)
from backend.app.domain.map_layers import generate_map_layers


@pytest.fixture
def base_state():
    """Provides standard base state for a Ratnagiri safety query."""
    return {
        "location": {"harbor": "Ratnagiri", "coordinates": [73.28, 16.99]},
        "intent": "SAFETY",
        "user_profile": {"origin_harbor": "Ratnagiri", "craft_profile": "motorized_boat"},
        "risk_assessment": Recommendation(
            status=RecommendationStatus.GO,
            summary="Conditions favorable for departure.",
            decisive_factors=["Wave height 0.9m below threshold"],
            next_action="Depart as planned",
        ),
        "observations": {
            "marine_conditions": {
                "significant_wave_height_m": 0.9,
                "swell_height_m": 0.6,
            },
            "weather_conditions": {
                "wind_speed_knots": 10.0,
                "wind_gust_knots": 13.0,
            },
        },
    }


def test_selective_layer_generation_safety_query(base_state):
    """Verifies that a standard safety query only generates relevant layers (Vessel + Safety Envelope)."""
    layers = generate_map_layers(base_state)
    layer_ids = [l.layer_id for l in layers]

    assert "layer_vessel_position" in layer_ids
    assert "layer_safety_envelope" in layer_ids
    # Should NOT force PFZ, routes, cyclone, or geofence when not requested/present
    assert "layer_pfz_advisories" not in layer_ids
    assert "layer_candidate_routes" not in layer_ids
    assert "layer_recommended_route" not in layer_ids
    assert "layer_cyclone_hazard" not in layer_ids
    assert len(layers) == 2


def test_vessel_position_geojson_structure(base_state):
    """Verifies Vessel Position layer geometry and properties."""
    layers = generate_map_layers(base_state)
    vessel_layer = next(l for l in layers if l.layer_id == "layer_vessel_position")

    assert vessel_layer.layer_type == "geojson"
    assert vessel_layer.visible is True
    assert vessel_layer.style["layer_category"] == "navigation"

    geojson = vessel_layer.geojson
    assert geojson["type"] == "Feature"
    assert geojson["geometry"]["type"] == "Point"
    assert geojson["geometry"]["coordinates"] == [73.28, 16.99]
    assert geojson["properties"]["harbor"] == "Ratnagiri"
    assert geojson["properties"]["status"] == "GO"


def test_safety_envelope_color_mapping(base_state):
    """Verifies safety envelope polygon color changes deterministically with risk status."""
    # Test GO -> Emerald/Green
    layers_go = generate_map_layers(base_state)
    env_go = next(l for l in layers_go if l.layer_id == "layer_safety_envelope")
    assert env_go.style["color"] == "#10b981"
    assert env_go.geojson["geometry"]["type"] == "Polygon"

    # Test CAUTION -> Amber
    state_caution = dict(base_state)
    state_caution["risk_assessment"] = Recommendation(
        status=RecommendationStatus.CAUTION,
        summary="Caution advised",
        decisive_factors=[],
        next_action="Operate with caution",
    )
    layers_caution = generate_map_layers(state_caution)
    env_caution = next(l for l in layers_caution if l.layer_id == "layer_safety_envelope")
    assert env_caution.style["color"] == "#f59e0b"

    # Test NO_GO -> Rose/Red
    state_nogo = dict(base_state)
    state_nogo["risk_assessment"] = Recommendation(
        status=RecommendationStatus.NO_GO,
        summary="Strict no-go",
        decisive_factors=[],
        next_action="Stay in port",
    )
    layers_nogo = generate_map_layers(state_nogo)
    env_nogo = next(l for l in layers_nogo if l.layer_id == "layer_safety_envelope")
    assert env_nogo.style["color"] == "#f43f5e"

    # Test UNKNOWN -> Slate
    state_unknown = dict(base_state)
    state_unknown["risk_assessment"] = Recommendation(
        status=RecommendationStatus.UNKNOWN,
        summary="Data stale",
        decisive_factors=[],
        next_action="Hold departure",
    )
    layers_unknown = generate_map_layers(state_unknown)
    env_unknown = next(l for l in layers_unknown if l.layer_id == "layer_safety_envelope")
    assert env_unknown.style["color"] == "#64748b"


def test_pfz_advisories_layer():
    """Verifies PFZ candidate markers are generated as a FeatureCollection with ranking & oceanographic telemetry."""
    state = {
        "location": {"harbor": "Ratnagiri", "coordinates": [73.28, 16.99]},
        "intent": "PFZ",
        "risk_assessment": Recommendation(
            status=RecommendationStatus.GO,
            summary="PFZ reachable safely",
            decisive_factors=[],
            next_action="Proceed to PFZ",
        ),
        "observations": {
            "pfz_search": {
                "ranked_candidates": [
                    {
                        "candidate_id": "PFZ-RTN-01",
                        "rank": 1,
                        "latitude": 16.95,
                        "longitude": 73.10,
                        "distance_nautical_miles": 10.5,
                        "bearing_degrees": 255.0,
                        "water_depth_m": 42.0,
                        "sea_surface_temp_c": 28.2,
                        "chlorophyll_mg_m3": 1.85,
                    },
                    {
                        "candidate_id": "PFZ-RTN-02",
                        "rank": 2,
                        "latitude": 17.15,
                        "longitude": 73.05,
                        "distance_nautical_miles": 18.2,
                        "bearing_degrees": 310.0,
                        "water_depth_m": 55.0,
                        "sea_surface_temp_c": 27.9,
                        "chlorophyll_mg_m3": 1.40,
                    },
                ]
            }
        },
    }

    layers = generate_map_layers(state)
    pfz_layer = next(l for l in layers if l.layer_id == "layer_pfz_advisories")

    assert pfz_layer.style["layer_category"] == "navigation"
    assert pfz_layer.style["color"] == "#10b981"

    fc = pfz_layer.geojson
    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) == 2

    f1 = fc["features"][0]
    assert f1["id"] == "PFZ-RTN-01"
    assert f1["geometry"]["coordinates"] == [73.10, 16.95]
    assert f1["properties"]["rank"] == 1
    assert f1["properties"]["water_depth_m"] == 42.0
    assert f1["properties"]["sst_c"] == 28.2


def test_routes_layer_separation_and_linestring():
    """Verifies candidate routes and recommended route separation and LineString geometries."""
    state = {
        "location": {"harbor": "Ratnagiri", "coordinates": [73.28, 16.99]},
        "destination": "Goa",
        "intent": "ROUTE",
        "risk_assessment": Recommendation(
            status=RecommendationStatus.CAUTION,
            summary="Inshore route safer",
            decisive_factors=[],
            next_action="Follow Route A",
        ),
        "observations": {
            "route_analysis": {
                "recommended_route_id": "ROUTE-A-INSHORE",
                "routes": [
                    {
                        "route_id": "ROUTE-A-INSHORE",
                        "name": "Inshore Coastal Passage",
                        "distance_km": 115.0,
                        "max_wave_height_m": 1.4,
                        "exposure_score": 0.28,
                        "risk_rating": "LOW",
                        "waypoints": [[73.28, 16.99], [73.40, 16.10], [73.83, 15.49]],
                    },
                    {
                        "route_id": "ROUTE-B-DEEPWATER",
                        "name": "Deepwater Offshore Passage",
                        "distance_km": 98.0,
                        "max_wave_height_m": 2.6,
                        "exposure_score": 0.72,
                        "risk_rating": "HIGH",
                        "waypoints": [[73.28, 16.99], [72.90, 16.20], [73.83, 15.49]],
                    },
                ],
            }
        },
    }

    layers = generate_map_layers(state)
    layer_ids = [l.layer_id for l in layers]

    assert "layer_recommended_route" in layer_ids
    assert "layer_candidate_routes" in layer_ids
    assert "layer_destination_port" in layer_ids

    # Check recommended route
    rec_layer = next(l for l in layers if l.layer_id == "layer_recommended_route")
    assert rec_layer.style["color"] == "#06b6d4"  # Solid Cyan
    assert rec_layer.geojson["geometry"]["type"] == "LineString"
    assert rec_layer.geojson["properties"]["route_id"] == "ROUTE-A-INSHORE"
    assert rec_layer.geojson["properties"]["is_recommended"] is True

    # Check candidate routes
    cand_layer = next(l for l in layers if l.layer_id == "layer_candidate_routes")
    assert cand_layer.style["color"] == "#f59e0b"  # Amber
    assert cand_layer.geojson["type"] == "FeatureCollection"
    assert len(cand_layer.geojson["features"]) == 1
    assert cand_layer.geojson["features"][0]["properties"]["route_id"] == "ROUTE-B-DEEPWATER"

    # Check destination port marker
    dest_layer = next(l for l in layers if l.layer_id == "layer_destination_port")
    assert dest_layer.geojson["properties"]["harbor"] == "Goa"
    assert dest_layer.geojson["geometry"]["type"] == "Point"


def test_cyclone_hazard_layer_generation():
    """Verifies Cyclone Hazard polygon is generated when cyclone warning or squall is active."""
    state = {
        "location": {"harbor": "Porbandar", "coordinates": [69.60, 21.64]},
        "intent": "HAZARDS",
        "risk_assessment": Recommendation(
            status=RecommendationStatus.NO_GO,
            summary="Severe cyclonic storm active",
            decisive_factors=["Cyclone warning active"],
            next_action="Stay in port",
        ),
        "observations": {
            "hazard_search": {
                "cyclone_warning_active": True,
                "squall_alert": True,
                "bulletin_id": "IMD-CYCLONE-ARABIAN-03",
                "headline": "Cyclonic Storm Advisory: Red Alert",
            }
        },
    }

    layers = generate_map_layers(state)
    hazard_layer = next(l for l in layers if l.layer_id == "layer_cyclone_hazard")

    assert hazard_layer.style["layer_category"] == "safety_critical"
    assert hazard_layer.style["color"] == "#ef4444"
    assert hazard_layer.geojson["geometry"]["type"] == "Polygon"
    assert hazard_layer.geojson["properties"]["severity"] == "WARNING"
    assert "Cyclonic Storm" in hazard_layer.geojson["properties"]["headline"]


def test_geofence_restricted_zone_layer_generation():
    """Verifies Geofence / Restricted Zone polygon layer is generated on geospatial hazard."""
    state = {
        "location": {"harbor": "Goa", "coordinates": [73.83, 15.49]},
        "intent": "GEOFENCE",
        "user_message": "Can I sail through the naval firing range?",
        "risk_assessment": Recommendation(
            status=RecommendationStatus.NO_GO,
            summary="Naval firing range is strictly prohibited",
            decisive_factors=["Hard geofence intersection"],
            next_action="Avoid naval sector",
        ),
        "observations": {
            "geospatial_hazard": {
                "hard_stop": True,
                "restricted": True,
                "restriction_name": "Naval Firing Range Foxtrot (Goa)",
            }
        },
    }

    layers = generate_map_layers(state)
    geo_layer = next(l for l in layers if l.layer_id == "layer_geofence_boundaries")

    assert geo_layer.style["layer_category"] == "safety_critical"
    assert geo_layer.geojson["type"] == "FeatureCollection"
    assert len(geo_layer.geojson["features"]) > 0
    props = geo_layer.geojson["features"][0]["properties"]
    assert "polygon_id" in props or "name" in props
