import hashlib
import json
import os
from datetime import datetime, timedelta, timezone

def generate_checksum(payload: dict) -> str:
    """Generate SHA-256 checksum of the JSON payload."""
    data_str = json.dumps(payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(data_str).hexdigest()

def create_snapshot(filename, provider, source_name, payload):
    now = datetime.now(timezone.utc)
    valid_to = now + timedelta(days=3)
    
    # Update timestamps in the payload
    if "observed_at" in payload:
        payload["observed_at"] = (now - timedelta(hours=1)).isoformat()
    if "valid_to" in payload:
        payload["valid_to"] = valid_to.isoformat()
    if "valid_from" in payload:
        payload["valid_from"] = now.isoformat()
    if "bulletin_date" in payload:
        payload["bulletin_date"] = now.isoformat()

    checksum = generate_checksum(payload)
    
    metadata = {
        "snapshot_id": f"SNAP-{filename.split('.')[0].upper()}",
        "provider": provider,
        "source_name": source_name,
        "captured_at": now.isoformat(),
        "valid_from": now.isoformat(),
        "valid_to": valid_to.isoformat(),
        "schema_version": "1.0.0",
        "checksum": checksum,
        "reference_url": "https://example.com/snapshot",
        "status": "SIMULATED"
    }

    final_doc = {
        "metadata": metadata,
        "payload": payload
    }

    os.makedirs("data/source_snapshots", exist_ok=True)
    with open(f"data/source_snapshots/{filename}", "w", encoding="utf-8") as f:
        json.dump(final_doc, f, indent=2)


marine = {
    "harbor": "Ratnagiri",
    "significant_wave_height_m": 1.2,
    "swell_height_m": 0.8,
    "swell_period_sec": 8.0,
    "surface_current_knots": 1.0,
    "sea_surface_temp_c": 28.0,
    "observed_at": "",
    "valid_to": "",
    "source_name": "INCOIS OSF Snapshot Fixture",
    "source_url": "https://incois.gov.in/portal/osf"
}

weather = {
    "harbor": "Ratnagiri",
    "wind_speed_knots": 12.0,
    "wind_gust_knots": 16.0,
    "wind_direction_deg": 245.0,
    "visibility_km": 10.0,
    "observed_at": "",
    "valid_to": "",
    "source_name": "IMD Coastal Weather Snapshot Fixture",
    "source_url": "https://mausam.imd.gov.in"
}

hazard = {
    "harbor": "Ratnagiri",
    "cyclone_warning_active": False,
    "squall_alert": False,
    "bulletin_id": "SNAP-IMD-001",
    "severity": "NORMAL",
    "headline": "No active storm hazard (Snapshot Fixture)",
    "valid_from": "",
    "valid_to": "",
    "source_name": "IMD Cyclone Warning Division Snapshot Fixture",
    "source_url": "https://mausam.imd.gov.in/hazards"
}

pfz = {
    "features": [
        {"id": "PFZ-SNAP-01", "lat": 16.92, "lon": 73.15, "sst_grad": 0.8, "chlorophyll": 1.4},
        {"id": "PFZ-SNAP-02", "lat": 17.05, "lon": 73.05, "sst_grad": 1.1, "chlorophyll": 1.9}
    ],
    "bulletin_date": "",
    "valid_to": "",
    "source_name": "INCOIS PFZ Mission Snapshot Fixture",
    "source_url": "https://incois.gov.in/portal/pfz"
}

create_snapshot("marine_ratnagiri.json", "INCOIS", "INCOIS OSF Snapshot", marine)
create_snapshot("weather_ratnagiri.json", "IMD", "IMD Coastal Weather Snapshot", weather)
create_snapshot("hazard_ratnagiri.json", "IMD", "IMD Hazard Snapshot", hazard)
create_snapshot("pfz_advisories.json", "INCOIS", "INCOIS PFZ Snapshot", pfz)

print("Snapshots created.")
