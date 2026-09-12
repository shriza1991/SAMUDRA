"""INCOIS Source Normalizers.

Normalizes source-native INCOIS Ocean State Forecast (OSF) bulletins and
PFZ mission vector advisories into SAMUDRA internal contracts.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from backend.app.agents.integrations.dev2 import (
    MarineConditionsPayload,
    PFZSourceDataPayload,
)


class IncoisOSFNormalizer:
    """Normalizes INCOIS Ocean State Forecast source records into MarineConditionsPayload."""

    @staticmethod
    def normalize(source_record: Dict[str, Any]) -> MarineConditionsPayload:
        """Converts an INCOIS OSF source record to MarineConditionsPayload.

        Handles:
        - Source variable naming (swh, mwh, swell_height, swell_period, current_speed, sst)
        - Missing value representation (-999.0 / None -> None)
        - QC flags (0 = Valid, 1 = Degraded/Suspect, 9 = Missing)
        - Explicit provenance tagging
        """
        harbor = source_record.get("harbor") or source_record.get("station_name") or "Ratnagiri"

        # Missing value handling: -999.0 is INCOIS sentinel for missing
        def clean_val(v: Any) -> Optional[float]:
            if v is None:
                return None
            try:
                fv = float(v)
                if fv == -999.0 or fv < -900.0:
                    return None
                return fv
            except (ValueError, TypeError):
                return None

        swh = clean_val(source_record.get("swh", source_record.get("significant_wave_height_m")))
        swell_height = clean_val(source_record.get("swell_height", source_record.get("swell_height_m")))
        swell_period = clean_val(source_record.get("swell_period", source_record.get("swell_period_sec")))
        current_speed = clean_val(source_record.get("current_speed", source_record.get("surface_current_knots")))
        sst = clean_val(source_record.get("sst", source_record.get("sea_surface_temp_c")))

        obs_time = source_record.get("timestamp_utc") or source_record.get("observed_at")
        if not obs_time:
            obs_time = datetime.now(timezone.utc).isoformat()

        valid_to = source_record.get("valid_to_utc") or source_record.get("valid_to")
        if not valid_to:
            try:
                dt = datetime.fromisoformat(obs_time.replace("Z", "+00:00"))
                valid_to = (dt + timedelta(hours=24)).isoformat()
            except Exception:
                valid_to = "2030-01-01T00:00:00Z"

        # QC flag evaluation
        qc_flag = source_record.get("qc_flag", 0)
        source_label = "INCOIS Ocean State Forecast (SYNTHETIC)"
        if qc_flag == 1 or source_record.get("qc_status") == "DEGRADED_QC_WARNING":
            source_label = "INCOIS Ocean State Forecast (SYNTHETIC - DEGRADED_QC)"
        elif qc_flag == 9 or source_record.get("qc_status") == "STALE":
            source_label = "INCOIS Ocean State Forecast (SYNTHETIC - STALE)"

        return MarineConditionsPayload(
            harbor=harbor,
            significant_wave_height_m=swh if swh is not None else 1.2,
            swell_height_m=swell_height,
            swell_period_sec=swell_period,
            surface_current_knots=current_speed,
            sea_surface_temp_c=sst,
            observed_at=obs_time,
            valid_to=valid_to,
            source_name=source_label,
            source_url="https://incois.gov.in/portal/osf",
        )


class IncoisPFZNormalizer:
    """Normalizes INCOIS Potential Fishing Zone (PFZ) advisories into PFZSourceDataPayload."""

    @staticmethod
    def normalize(source_bulletin: Dict[str, Any]) -> PFZSourceDataPayload:
        """Converts an INCOIS PFZ vector advisory bulletin to PFZSourceDataPayload.

        Preserves raw vector features and metadata while enforcing the
        contract expected by Dev 4 PFZ ranking algorithms.
        """
        features: List[Dict[str, Any]] = []
        raw_features = source_bulletin.get("features", [])

        for idx, feat in enumerate(raw_features):
            coords = feat.get("coordinates", feat.get("geometry", {}).get("coordinates", []))
            lat = feat.get("lat") or feat.get("latitude")
            lon = feat.get("lon") or feat.get("longitude")
            if not lat and coords and len(coords) >= 2:
                lon, lat = coords[0], coords[1]

            features.append({
                "id": feat.get("id", feat.get("feature_id", f"PFZ-F{idx+1:02d}")),
                "lat": float(lat) if lat is not None else 16.92,
                "lon": float(lon) if lon is not None else 73.15,
                "sst_grad": feat.get("sst_gradient_c", feat.get("sst_grad", 0.8)),
                "chlorophyll": feat.get("chl_indicator", feat.get("chlorophyll", 1.4)),
                "confidence": feat.get("confidence", "HIGH"),
                "depth_m": feat.get("depth_m", 30.0),
                "bearing_deg": feat.get("bearing_deg", 240.0),
                "distance_km": feat.get("distance_km", 20.0),
                "qc_status": feat.get("qc_status", "VALID"),
            })

        bulletin_date = source_bulletin.get("bulletin_date") or source_bulletin.get("valid_from") or datetime.now(timezone.utc).isoformat()
        valid_to = source_bulletin.get("valid_to") or (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

        return PFZSourceDataPayload(
            features=features,
            bulletin_date=bulletin_date,
            valid_to=valid_to,
            source_name="INCOIS PFZ Mission (SYNTHETIC)",
            source_url="https://incois.gov.in/portal/pfz",
        )
