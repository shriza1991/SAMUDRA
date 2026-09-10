import hashlib
import json
from pathlib import Path

snapshots_dir = Path("data/source_snapshots")
for file in snapshots_dir.glob("*.json"):
    with open(file, "r", encoding="utf-8") as f:
        data = json.load(f)

    data["metadata"]["valid_from"] = "2026-01-01T00:00:00+00:00"
    data["metadata"]["valid_to"] = "2030-01-01T00:00:00+00:00"

    if "valid_from" in data["payload"]:
        data["payload"]["valid_from"] = "2026-01-01T00:00:00+00:00"
    if "valid_to" in data["payload"]:
        data["payload"]["valid_to"] = "2030-01-01T00:00:00+00:00"

    payload_str = json.dumps(data["payload"], sort_keys=True).encode("utf-8")
    data["metadata"]["checksum"] = hashlib.sha256(payload_str).hexdigest()

    with open(file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Updated {file.name}, new checksum: {data['metadata']['checksum']}")
