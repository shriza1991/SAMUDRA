"""F04 Persistence, Evidence & Round-Trip Test Suite.

Verifies the full persistence lifecycle:
REQUEST -> ANALYSIS -> RISK ASSESSMENT -> EVIDENCE -> MAP LAYERS -> PERSIST -> DATABASE -> RELOAD -> SAME INFORMATION

Tests:
1. test_roundtrip_request_persistence
2. test_roundtrip_recommendation_fidelity
3. test_roundtrip_evidence_items
4. test_roundtrip_evidence_source_preservation
5. test_roundtrip_map_layer_metadata
6. test_roundtrip_trace_steps
7. test_run_isolation_across_threads
8. test_conversation_history_retrieval
9. test_persistence_degraded_warning
10. test_duplicate_run_protection
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock
import pytest
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from shapely.wkt import loads as wkt_loads
from shapely import to_wkb

from geoalchemy2 import Geometry
import geoalchemy2.admin.dialects.sqlite as sqlite_admin

from backend.app.contracts.chat import (
    AgentTraceItem,
    ChatRequest,
    ChatResponse,
    Confidence,
    ConfidenceLevel,
    EvidenceItem as ContractEvidenceItem,
    MapLayer as ContractMapLayer,
    Recommendation,
    RecommendationStatus,
    UserContext,
)
from backend.app.db.models import Base, ConversationThread, EvidenceItem, MapLayer, Run, RunStatus
from backend.app.db.repositories import (
    ConversationRepository,
    EvidenceRepository,
    MapLayerRepository,
    RunRepository,
)
from backend.app.services.agent_run_service import AgentRunService, _DuplicateRunError


# ---------------------------------------------------------------------------
# SQLite Compatibility Compilers & Fixtures
# ---------------------------------------------------------------------------


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(UUID, "sqlite")
def _compile_uuid_sqlite(type_, compiler, **kw):
    return "CHAR(36)"


@compiles(Geometry, "sqlite")
def _compile_geom_sqlite(type_, compiler, **kw):
    return "BLOB"


def _ewkt_to_wkb(ewkt):
    if not ewkt:
        return b""
    wkt_str = ewkt.split(";")[-1] if ";" in ewkt else ewkt
    geom = wkt_loads(wkt_str)
    return to_wkb(geom, hex=True)


@pytest.fixture
def test_db_session():
    """Create a fresh in-memory SQLite DB session with PostGIS/JSONB function shims."""
    engine = sa.create_engine("sqlite:///:memory:")

    @sa.event.listens_for(engine, "connect")
    def connect(dbapi_connection, connection_record):
        dbapi_connection.create_function("AsEWKB", 1, lambda x: x)
        dbapi_connection.create_function("AsEWKT", 1, lambda x: str(x))
        dbapi_connection.create_function("ST_AsBinary", 1, lambda x: x)
        dbapi_connection.create_function("ST_GeomFromWKB", -1, lambda *args: args[0])
        dbapi_connection.create_function("GeomFromWKB", -1, lambda *args: args[0])
        dbapi_connection.create_function("GeomFromEWKT", 1, _ewkt_to_wkb)

    with patch.object(sqlite_admin, "after_create", lambda *args, **kwargs: None), \
         patch.object(sqlite_admin, "before_create", lambda *args, **kwargs: None):
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine)
        session = Session()
        try:
            yield session
        finally:
            session.close()


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------


def test_roundtrip_request_persistence(test_db_session):
    """Verify that a complete ChatRequest envelope is persisted and reloaded losslessly."""
    conv_repo = ConversationRepository(test_db_session)
    run_repo = RunRepository(test_db_session)

    thread_id = "test-thread-request-001"
    run_id = uuid.uuid4()
    request_id = "req-test-12345"

    request_envelope = {
        "message": "Can I go fishing near Ratnagiri tomorrow morning?",
        "conversation_id": thread_id,
        "user_context": {
            "origin_harbor": "Ratnagiri",
            "craft_profile": "motorized_boat",
            "language_preference": "mr",
        },
        "data_mode": "SYNTHETIC",
        "request_id": request_id,
    }

    metadata = {
        "request_id": request_id,
        "data_mode": "SYNTHETIC",
        "request": request_envelope,
    }

    run = run_repo.create(thread_id=thread_id, metadata_json=metadata, run_id=run_id)
    assert run.id == run_id

    # Retrieve in a fresh query
    details = run_repo.get_run_with_details(run_id)
    assert details is not None
    assert details["id"] == str(run_id)
    assert details["thread_id"] == thread_id
    assert details["request_id"] == request_id
    assert details["data_mode"] == "SYNTHETIC"

    loaded_req = details["request"]
    assert loaded_req["message"] == "Can I go fishing near Ratnagiri tomorrow morning?"
    assert loaded_req["user_context"]["craft_profile"] == "motorized_boat"
    assert loaded_req["user_context"]["origin_harbor"] == "Ratnagiri"


def test_roundtrip_recommendation_fidelity(test_db_session):
    """Verify that recommendation status, reasons, confidence, and summaries survive DB reload."""
    run_repo = RunRepository(test_db_session)
    thread_id = "test-thread-rec-002"
    run_id = uuid.uuid4()

    response_envelope = {
        "answer": "Safe to depart. Sea conditions are calm.",
        "intent": "VOYAGE_SAFETY",
        "language": "en",
        "recommendation": {
            "status": "GO",
            "summary": "Safe to depart. Wave height 0.8m, wind 12 knots within motorized boat safe limits.",
            "next_action": "Proceed with standard safety checks and life jackets on board.",
            "decisive_factors": ["Wave height 0.8m <= 1.5m limit", "Wind speed 12 knots <= 20 knots limit"],
            "non_decisive_factors": ["Visibility good (> 5km)"],
            "threshold_comparisons": [],
            "provenance": [],
            "evidence_ids": ["ev-001", "ev-002"],
            "warnings": [],
        },
        "confidence": {
            "level": "HIGH",
            "reasons": ["Fresh INCOIS OSF observation", "Fresh IMD weather bulletin"],
        },
        "warnings": [],
        "suggested_followups": ["Check weather before return", "Confirm crew safety gear"],
    }

    metadata = {
        "request_id": "req-rec-002",
        "data_mode": "SYNTHETIC",
        "response": response_envelope,
    }

    run_repo.create(thread_id=thread_id, metadata_json=metadata, run_id=run_id)
    run_repo.update_status(run_id, RunStatus.COMPLETED)

    details = run_repo.get_run_with_details(run_id)
    assert details is not None
    assert details["status"] == "COMPLETED"

    loaded_resp = details["response"]
    assert loaded_resp["intent"] == "VOYAGE_SAFETY"
    assert loaded_resp["recommendation"]["status"] == "GO"
    assert "within motorized boat safe limits" in loaded_resp["recommendation"]["summary"]
    assert loaded_resp["confidence"]["level"] == "HIGH"
    assert len(loaded_resp["suggested_followups"]) == 2


def test_roundtrip_evidence_items(test_db_session):
    """Verify that evidence items retain source, metrics, quality flags, and time windows."""
    run_repo = RunRepository(test_db_session)
    evidence_repo = EvidenceRepository(test_db_session)

    thread_id = "test-thread-evidence-003"
    run_id = uuid.uuid4()
    run_repo.create(thread_id=thread_id, run_id=run_id)

    raw_data_incois = {
        "evidence_id": "ev-incois-swh-001",
        "metric_name": "significant_wave_height",
        "metric_value": 0.85,
        "metric_unit": "m",
        "observed_time": "2026-09-12T06:00:00Z",
        "valid_from": "2026-09-12T06:00:00Z",
        "valid_to": "2026-09-12T12:00:00Z",
        "retrieved_at": "2026-09-12T06:05:00Z",
        "source_url": "https://incois.gov.in/osf/api",
        "quality_flags": ["QC_PASSED", "SYNTHETIC_DATA"],
        "geometry": {"type": "Point", "coordinates": [73.2, 16.9]},
    }

    evidence_repo.create(
        run_id=run_id,
        source="INCOIS",
        raw_data=raw_data_incois,
        extracted_entities={},
    )

    details = run_repo.get_run_with_details(run_id)
    assert details["evidence_count"] == 1

    ev = details["evidence"][0]
    assert ev["source"] == "INCOIS"
    assert ev["raw_data"]["metric_name"] == "significant_wave_height"
    assert ev["raw_data"]["metric_value"] == 0.85
    assert ev["raw_data"]["metric_unit"] == "m"
    assert "QC_PASSED" in ev["raw_data"]["quality_flags"]
    assert ev["raw_data"]["geometry"]["coordinates"] == [73.2, 16.9]


def test_roundtrip_evidence_source_preservation(test_db_session):
    """Verify that evidence sources from multiple official providers (INCOIS, IMD, MOSDAC) are preserved."""
    run_repo = RunRepository(test_db_session)
    evidence_repo = EvidenceRepository(test_db_session)

    thread_id = "test-thread-sources-004"
    run_id = uuid.uuid4()
    run_repo.create(thread_id=thread_id, run_id=run_id)

    evidence_repo.create(
        run_id=run_id,
        source="INCOIS",
        raw_data={"metric_name": "significant_wave_height", "metric_value": 0.9},
        extracted_entities={},
    )
    evidence_repo.create(
        run_id=run_id,
        source="IMD",
        raw_data={"metric_name": "wind_speed", "metric_value": 11.5},
        extracted_entities={},
    )
    evidence_repo.create(
        run_id=run_id,
        source="MOSDAC",
        raw_data={"metric_name": "sea_surface_temperature", "metric_value": 28.5},
        extracted_entities={},
    )

    ev_list = evidence_repo.get_by_run_id(run_id)
    assert len(ev_list) == 3

    sources = {ev.source for ev in ev_list}
    assert sources == {"INCOIS", "IMD", "MOSDAC"}


def test_roundtrip_map_layer_metadata(test_db_session):
    """Verify that map layer types, properties, and styles survive database round-trip."""
    run_repo = RunRepository(test_db_session)
    map_repo = MapLayerRepository(test_db_session)

    thread_id = "test-thread-map-005"
    run_id = uuid.uuid4()
    run_repo.create(thread_id=thread_id, run_id=run_id)

    geom = {
        "type": "Polygon",
        "coordinates": [
            [[73.0, 16.5], [73.5, 16.5], [73.5, 17.0], [73.0, 17.0], [73.0, 16.5]]
        ],
    }
    props = {
        "layer_id": "hazard-layer-001",
        "name": "High Wave Alert Zone",
        "visible": True,
        "style": {"fillColor": "#ff0000", "fillOpacity": 0.4},
    }

    map_repo.create_from_geojson(
        run_id=run_id,
        layer_type="hazard_polygon",
        geojson_geom=geom,
        properties=props,
    )

    details = run_repo.get_run_with_details(run_id)
    assert details["map_layer_count"] == 1

    ml = details["map_layers"][0]
    assert ml["layer_type"] == "hazard_polygon"
    assert ml["properties"]["layer_id"] == "hazard-layer-001"
    assert ml["properties"]["name"] == "High Wave Alert Zone"
    assert ml["properties"]["style"]["fillColor"] == "#ff0000"


def test_roundtrip_trace_steps(test_db_session):
    """Verify that agent execution trace steps are preserved in run metadata."""
    run_repo = RunRepository(test_db_session)
    thread_id = "test-thread-trace-006"
    run_id = uuid.uuid4()

    trace_steps = [
        {"step": 1, "node": "incois_fetcher", "action": "Retrieved OSF observations", "status": "completed"},
        {"step": 2, "node": "imd_fetcher", "action": "Retrieved weather forecast", "status": "completed"},
        {"step": 3, "node": "risk_engine", "action": "Deterministic evaluation GO", "status": "completed"},
    ]

    metadata = {
        "request_id": "req-trace-006",
        "data_mode": "SYNTHETIC",
        "trace": trace_steps,
    }

    run_repo.create(thread_id=thread_id, metadata_json=metadata, run_id=run_id)

    details = run_repo.get_run_with_details(run_id)
    assert len(details["trace"]) == 3
    assert details["trace"][0]["node"] == "incois_fetcher"
    assert details["trace"][2]["action"] == "Deterministic evaluation GO"


def test_run_isolation_across_threads(test_db_session):
    """Verify that runs and evidence in distinct threads remain isolated without cross-talk."""
    run_repo = RunRepository(test_db_session)
    evidence_repo = EvidenceRepository(test_db_session)

    # Thread 1
    thread_1 = "thread-alpha"
    run_1_id = uuid.uuid4()
    run_repo.create(thread_id=thread_1, metadata_json={"request_id": "req-a"}, run_id=run_1_id)
    evidence_repo.create(run_id=run_1_id, source="INCOIS", raw_data={"swh": 0.5}, extracted_entities={})

    # Thread 2
    thread_2 = "thread-beta"
    run_2_id = uuid.uuid4()
    run_repo.create(thread_id=thread_2, metadata_json={"request_id": "req-b"}, run_id=run_2_id)
    evidence_repo.create(run_id=run_2_id, source="IMD", raw_data={"wind": 25.0}, extracted_entities={})

    # Verify Thread 1 runs
    runs_1 = run_repo.get_all_by_thread(thread_1)
    assert len(runs_1) == 1
    assert runs_1[0].id == run_1_id

    # Verify Thread 2 runs
    runs_2 = run_repo.get_all_by_thread(thread_2)
    assert len(runs_2) == 1
    assert runs_2[0].id == run_2_id

    # Verify evidence isolation
    ev_1 = evidence_repo.get_by_run_id(run_1_id)
    assert len(ev_1) == 1
    assert ev_1[0].source == "INCOIS"

    ev_2 = evidence_repo.get_by_run_id(run_2_id)
    assert len(ev_2) == 1
    assert ev_2[0].source == "IMD"


def test_conversation_history_retrieval(test_db_session):
    """Verify that multiple conversation turns in a thread are retrievable in chronological order."""
    run_repo = RunRepository(test_db_session)
    thread_id = "thread-multi-turn-008"

    # Turn 1
    run_1_id = uuid.uuid4()
    run_repo.create(
        thread_id=thread_id,
        metadata_json={
            "request_id": "req-turn-1",
            "request": {"message": "Is it safe to go out today?"},
            "response": {"answer": "Yes, sea is calm.", "recommendation": {"status": "GO"}},
        },
        run_id=run_1_id,
    )
    run_repo.update_status(run_1_id, RunStatus.COMPLETED)

    # Turn 2
    run_2_id = uuid.uuid4()
    run_repo.create(
        thread_id=thread_id,
        metadata_json={
            "request_id": "req-turn-2",
            "request": {"message": "What about tomorrow evening?"},
            "response": {"answer": "Caution advised due to rising swell.", "recommendation": {"status": "CAUTION"}},
        },
        run_id=run_2_id,
    )
    run_repo.update_status(run_2_id, RunStatus.COMPLETED)

    # Retrieve all runs in thread
    all_runs = run_repo.get_all_by_thread(thread_id)
    assert len(all_runs) == 2

    # Verify details for each turn
    details_1 = run_repo.get_run_with_details(run_1_id)
    details_2 = run_repo.get_run_with_details(run_2_id)

    assert details_1["request"]["message"] == "Is it safe to go out today?"
    assert details_1["response"]["recommendation"]["status"] == "GO"

    assert details_2["request"]["message"] == "What about tomorrow evening?"
    assert details_2["response"]["recommendation"]["status"] == "CAUTION"


@pytest.mark.asyncio
async def test_persistence_degraded_warning():
    """Verify that if database persistence fails during run completion, response returns with warning."""
    service = AgentRunService(data_mode="SYNTHETIC")

    req = ChatRequest(
        message="Can I go fishing?",
        conversation_id="conv-degraded-009",
        user_context=UserContext(origin_harbor="Ratnagiri", craft_profile="motorized_boat"),
    )
    run_id = str(uuid.uuid4())

    mock_state = {
        "response": "Safe conditions to sail.",
        "risk_assessment": {
            "status": "GO",
            "summary": "Safe conditions",
            "next_action": "Proceed with safety precautions",
            "decisive_factors": [],
            "non_decisive_factors": [],
            "threshold_comparisons": [],
            "provenance": [],
            "evidence_ids": [],
            "warnings": [],
        },
        "confidence": {"level": "HIGH", "reasons": []},
        "evidence": [],
        "map_layers": [],
        "warnings": [],
        "messages": [],
    }

    # Mock SessionLocal to succeed on creation (call 1) but raise during run completion (call 2)
    call_count = [0]

    class FailingSession:
        def __enter__(self):
            call_count[0] += 1
            if call_count[0] > 1:
                raise sa.exc.OperationalError("DB connection dropped", params={}, orig=None)
            mock_sess = MagicMock()
            mock_sess.query.return_value.filter_by.return_value.first.return_value = None
            return mock_sess

        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("backend.app.services.agent_run_service.run_orca_graph", return_value=mock_state), \
         patch("backend.app.db.session.SessionLocal", side_effect=FailingSession):

        resp = await service.run_agent(
            user_message=req.message,
            conversation_id=req.conversation_id,
            run_id=run_id,
            user_context=req.user_context.model_dump(),
        )

        # Must return valid response, NOT crash or raise 500
        assert resp is not None
        assert resp.recommendation.status == RecommendationStatus.GO
        # Must contain persistence degraded warning
        assert any("[PERSISTENCE-DEGRADED]" in w for w in resp.warnings)


@pytest.mark.asyncio
async def test_duplicate_run_protection():
    """Verify that attempting to start a run with an existing active run raises _DuplicateRunError."""
    service = AgentRunService(data_mode="SYNTHETIC")

    req = ChatRequest(
        message="Can I go fishing?",
        conversation_id="conv-dup-010",
        user_context=UserContext(),
    )
    run_id = str(uuid.uuid4())

    mock_active_run = MagicMock()
    mock_active_run.id = uuid.uuid4()

    mock_session = MagicMock()
    mock_session.query.return_value.filter_by.return_value.first.return_value = mock_active_run

    class ActiveRunSession:
        def __enter__(self):
            return mock_session

        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("backend.app.db.session.SessionLocal", side_effect=ActiveRunSession):
        with pytest.raises(_DuplicateRunError):
            await service.run_agent(
                user_message=req.message,
                conversation_id=req.conversation_id,
                run_id=run_id,
                user_context=req.user_context.model_dump(),
            )
