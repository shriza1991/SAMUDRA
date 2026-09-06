#!/usr/bin/env python3
"""Smoke Test for Open-Meteo Live Integration.

Owned by Dev 2 (Backend Platform).
Run manually to verify live integration without respx mocks.
"""

import sys
import logging
from pprint import pprint

from backend.app.agents.integrations.contracts import ToolInvocationContext
from backend.app.connectors.open_meteo import OpenMeteoConnector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("smoke_test")

def main():
    logger.info("Initializing OpenMeteoConnector...")
    connector = OpenMeteoConnector()
    
    ctx = ToolInvocationContext(origin_harbor="Ratnagiri")
    
    logger.info("Fetching Marine Conditions for Ratnagiri...")
    marine = connector.get_marine_conditions(ctx)
    print("\n--- Marine Conditions ---")
    pprint(marine.model_dump())
    
    logger.info("\nFetching Weather Conditions for Ratnagiri...")
    weather = connector.get_weather_conditions(ctx)
    print("\n--- Weather Conditions ---")
    pprint(weather.model_dump())
    
    logger.info("\nSmoke test completed successfully.")

if __name__ == "__main__":
    main()
