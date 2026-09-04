"""External Data Connectors Package.

Owned by Dev 2 (Backend Platform).
Responsible for:
- INCOIS PFZ and Ocean State Forecast (OSF) connectors
- IMD Marine Warning Bulletin connector
- MOSDAC Earth Observation context adapter
- Open-Meteo Marine fallback connector
- DATA_MODE routing (LIVE -> HYBRID fallback -> SNAPSHOT)

Must NOT contain:
- LLM prompt logic or agent state
- Risk threshold business logic
"""

from typing import Dict, Any


class BaseConnector:
    """Abstract base class for external data source adapters."""

    def __init__(self, data_mode: str = "HYBRID"):
        self.data_mode = data_mode

    async def fetch(self, **kwargs) -> Dict[str, Any]:
        raise NotImplementedError
