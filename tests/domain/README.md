# Domain & Deterministic Engine Tests

> **Owned by Dev 4 (Marine/Geo Intelligence)**

This directory tests:
1. **Shapely Geofence Intersections**:
   - Point-in-polygon checks for harbors and hazard zones.
   - Line-string intersection checks against maritime boundaries (MPAs, naval ranges, IMBL).
2. **Geodesic Distance & Bearings**:
   - Accurate distance calculations (km / nautical miles) on WGS84 ellipsoid.
   - Compass bearings (0–360°).
3. **Deterministic Risk Rules Engine**:
   - Wave height and wind threshold evaluations.
   - Hard-stop triggers on active IMD alerts.
   - Stale data detection preventing `GO` status.
