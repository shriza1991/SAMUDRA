"""MOSDAC / ISRO Satellite EO Source Normalizers.

Normalizes source-native Oceansat-3 OCM (Ocean Colour Monitor) chlorophyll-a
and INSAT-3D/3DR thermal SST grid products into normalized SAMUDRA structures.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional


class MosdacEONormalizer:
    """Normalizes MOSDAC satellite grid cell products into normalized EO cell representations."""

    @staticmethod
    def normalize(source_cell: Dict[str, Any]) -> Dict[str, Any]:
        """Converts a MOSDAC satellite product record to a normalized EO cell dict.

        Handles:
        - Source variable naming (CHL_A, SST, QA_FLAGS, PIXEL_UNCERTAINTY)
        - QA_FLAGS mapping (0=Clear, 1=Cloud Obscured, 2=No Data)
        - Missing value sentinel (-999.0 -> None)
        - Explicit labeling: strictly environmental data, NOT measured fishing catch
        """
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

        sst = clean_val(source_cell.get("SST", source_cell.get("sst_c")))
        chl = clean_val(source_cell.get("CHL_A", source_cell.get("chlorophyll_mg_m3")))
        uncertainty = clean_val(source_cell.get("PIXEL_UNCERTAINTY", source_cell.get("uncertainty", 0.12)))

        qa_flags = source_cell.get("QA_FLAGS", 0)
        qc_status = source_cell.get("qc_status", "VALID")

        if qa_flags == 1 or qc_status == "CLOUD_OBSCURED":
            qc_status = "CLOUD_OBSCURED"
            sst = None
            chl = None
        elif qa_flags == 2 or qc_status == "NO_DATA":
            qc_status = "NO_DATA"
            sst = None
            chl = None
        elif uncertainty and uncertainty > 0.4:
            qc_status = "DEGRADED_QC_WARNING"

        obs_time = source_cell.get("ACQUISITION_TIME") or source_cell.get("observation_time")
        if isinstance(obs_time, datetime):
            obs_time = obs_time.isoformat()
        elif not obs_time:
            obs_time = datetime.now(timezone.utc).isoformat()

        return {
            "cell_id": source_cell.get("cell_id", source_cell.get("pixel_id", "CELL-00-00")),
            "latitude": float(source_cell.get("LATITUDE", source_cell.get("latitude", 16.0))),
            "longitude": float(source_cell.get("LONGITUDE", source_cell.get("longitude", 73.0))),
            "observation_time": str(obs_time),
            "sst_c": sst,
            "chlorophyll_mg_m3": chl,
            "uncertainty": uncertainty,
            "qc_status": qc_status,
            "cloud_fraction": float(source_cell.get("cloud_fraction", 0.0 if qc_status == "VALID" else 0.85)),
            "source_name": "MOSDAC / ISRO Oceansat-3 OCM & INSAT-3D (SYNTHETIC)",
            "product_type": "SATELLITE_OCEAN_COLOR_THERMAL",
            "provenance_note": "Synthetic satellite environmental observation, NOT measured fishing catch productivity",
        }
