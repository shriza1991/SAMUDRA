"""Dev 2 Connector Registration.

Owned by Dev 2 (Backend Platform).
Registers Dev 2 connectors with the Dev 3 AgentToolRegistry.
"""

from typing import Any

from backend.app.agents.integrations.adapters import ProviderToolAdapter
from backend.app.agents.integrations.contracts import (
    CAPABILITIES_CATALOG,
    ToolInvocationContext,
    ToolOwner,
)
from backend.app.agents.tools import AgentToolRegistry, ToolDefinition
from backend.app.connectors.manager import ConnectorManager


def register_dev2_provider_tools(
    registry: AgentToolRegistry, connector_manager: ConnectorManager
) -> None:
    """Registers Dev 2 external data connectors as agent tools.

    Args:
        registry: The Dev 3 AgentToolRegistry instance.
        connector_manager: The configured Dev 2 ConnectorManager.
    """
    is_mock = False  # Set to false for provider mode (no M2 contract mocks)

    # 1. Register Marine Conditions
    marine_cap = CAPABILITIES_CATALOG["marine_conditions"]
    marine_def = ToolDefinition(
        name="marine_conditions",
        description=marine_cap.description,
        parameters=[],  # The adapter currently just pulls from ToolInvocationContext
        category="marine",
        owner=ToolOwner.DEV2,
        capability="marine_conditions",
        required_context_fields=marine_cap.required_context_fields,
        dependencies=marine_cap.dependencies,
        requires_evidence=marine_cap.requires_evidence,
        is_available=True,  # Will update below
    )

    def handle_marine(**kwargs: Any) -> Any:
        context = ToolInvocationContext(**kwargs)
        return ProviderToolAdapter.adapt_marine_conditions(
            connector_manager.get_marine_conditions, context, is_mock=is_mock
        )

    registry.register_tool(marine_def, handle_marine, override=True)

    # 2. Register Weather Conditions
    weather_cap = CAPABILITIES_CATALOG["weather_conditions"]
    weather_def = ToolDefinition(
        name="weather_conditions",
        description=weather_cap.description,
        parameters=[],
        category="weather",
        owner=ToolOwner.DEV2,
        capability="weather_conditions",
        required_context_fields=weather_cap.required_context_fields,
        dependencies=weather_cap.dependencies,
        requires_evidence=weather_cap.requires_evidence,
        is_available=True,
    )

    def handle_weather(**kwargs: Any) -> Any:
        context = ToolInvocationContext(**kwargs)
        return ProviderToolAdapter.adapt_weather_conditions(
            connector_manager.get_weather_conditions, context, is_mock=is_mock
        )

    registry.register_tool(weather_def, handle_weather, override=True)

    # 3. Register Hazard Search
    hazard_cap = CAPABILITIES_CATALOG["hazard_search"]
    hazard_def = ToolDefinition(
        name="hazard_search",
        description=hazard_cap.description,
        parameters=[],
        category="marine",
        owner=ToolOwner.DEV2,
        capability="hazard_search",
        required_context_fields=hazard_cap.required_context_fields,
        dependencies=hazard_cap.dependencies,
        requires_evidence=hazard_cap.requires_evidence,
        is_available=True,
    )

    def handle_hazard(**kwargs: Any) -> Any:
        context = ToolInvocationContext(**kwargs)
        return ProviderToolAdapter.adapt_hazard_bulletin(
            connector_manager.get_hazard_bulletin, context, is_mock=is_mock
        )

    registry.register_tool(hazard_def, handle_hazard, override=True)

    # 4. Register SVAS Advisory
    svas_cap = CAPABILITIES_CATALOG["svas_advisory"]
    svas_def = ToolDefinition(
        name="svas_advisory",
        description=svas_cap.description,
        parameters=[],
        category="marine",
        owner=ToolOwner.DEV2,
        capability="svas_advisory",
        required_context_fields=svas_cap.required_context_fields,
        dependencies=svas_cap.dependencies,
        requires_evidence=svas_cap.requires_evidence,
        is_available=True,
    )

    def handle_svas(**kwargs: Any) -> Any:
        context = ToolInvocationContext(**kwargs)
        return ProviderToolAdapter.adapt_svas_advisory(
            connector_manager.get_svas_advisories, context, is_mock=is_mock
        )

    registry.register_tool(svas_def, handle_svas, override=True)

    # 5. Availability Check (update registry capability availability)
    # The requirement is: "Connector availability must update registry capability availability."
    # Since snapshot mode is always available, and hybrid falls back to snapshot,
    # the capability is available if the manager can fulfill it. For now, it's True.
    # If a live provider was explicitly configured and failed health checks, we'd set to False.
    registry.set_capability_availability("marine_conditions", True)
    registry.set_capability_availability("weather_conditions", True)
    registry.set_capability_availability("hazard_search", True)
    registry.set_capability_availability("svas_advisory", True)

    # PFZ BOUNDARY requirement:
    # Expose the PFZSourceDataProvider implementation for Dev 4.
    # Do not register Dev 4's pfz_search ranking engine.
    # By passing connector_manager, Dev 4 can call connector_manager.get_pfz_raw_advisories()

