"""Database repository integration tests.

Owned by Dev 2 (Backend Platform).
Tests full SQLAlchemy repository lifecycle with PostGIS verification.
"""

import pytest
import uuid
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError, IntegrityError, StatementError

from backend.app.core.config import settings
from backend.app.db.models import Base, RunStatus
from backend.app.db.repositories import (
    ConversationRepository,
    RunRepository,
    EvidenceRepository,
    MapLayerRepository,
    ConnectorSnapshotRepository,
    ConnectorStatusRepository,
)

# Test connection handling
try:
    engine = create_engine(settings.SYNC_DATABASE_URL)
    with engine.connect():
        db_available = True
except OperationalError:
    db_available = False

pytestmark = pytest.mark.skipif(
    not db_available,
    reason="PostgreSQL/PostGIS server is unavailable. Integration tests skipped."
)

@pytest.fixture(scope="session")
def test_engine():
    # Only called if db_available is True
    engine = create_engine(settings.SYNC_DATABASE_URL)
    # Recreate all tables
    Base.metadata.drop_all(bind=engine)
    # Ensure postgis is created
    with engine.connect() as conn:
        conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS postgis"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session(test_engine):
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()

import sqlalchemy as sa

def test_conversation_lifecycle(db_session):
    repo = ConversationRepository(db_session)
    thread_id = str(uuid.uuid4())
    
    # Create
    thread = repo.create(thread_id, {"active_harbor": "Mumbai"})
    assert thread.thread_id == thread_id
    assert thread.context_json["active_harbor"] == "Mumbai"
    
    # Read
    fetched = repo.get_by_thread_id(thread_id)
    assert fetched.id == thread.id
    
    # Update
    updated = repo.update(thread_id, {"active_harbor": "Goa"})
    assert updated.context_json["active_harbor"] == "Goa"
    
    # Delete
    assert repo.delete(thread_id) is True
    assert repo.get_by_thread_id(thread_id) is None

def test_run_lifecycle(db_session):
    conv_repo = ConversationRepository(db_session)
    run_repo = RunRepository(db_session)
    
    thread_id = str(uuid.uuid4())
    conv_repo.create(thread_id, {})
    
    # Create run
    run = run_repo.create(thread_id, {"test": "metadata"})
    assert run.run_status == RunStatus.PENDING
    
    # Update status
    updated = run_repo.update_status(run.id, RunStatus.COMPLETED)
    assert updated.run_status == RunStatus.COMPLETED

def test_evidence_persistence(db_session):
    conv_repo = ConversationRepository(db_session)
    run_repo = RunRepository(db_session)
    ev_repo = EvidenceRepository(db_session)
    
    thread_id = str(uuid.uuid4())
    conv_repo.create(thread_id, {})
    run = run_repo.create(thread_id, {})
    
    # Create evidence
    ev = ev_repo.create(run.id, "INCOIS", {"wave": 2.5}, {"location": "Goa"})
    assert ev.source == "INCOIS"
    assert ev.raw_data["wave"] == 2.5

def test_map_layer_geometry_roundtrip(db_session):
    conv_repo = ConversationRepository(db_session)
    run_repo = RunRepository(db_session)
    map_repo = MapLayerRepository(db_session)
    
    thread_id = str(uuid.uuid4())
    conv_repo.create(thread_id, {})
    run = run_repo.create(thread_id, {})
    
    # Point
    point_layer = map_repo.create_from_geojson(
        run.id, "point",
        {"type": "Point", "coordinates": [73.28, 16.99]},
        {"name": "Ratnagiri"}
    )
    assert point_layer.layer_type == "point"
    
    # LineString
    line_layer = map_repo.create_from_geojson(
        run.id, "line",
        {"type": "LineString", "coordinates": [[73.0, 16.0], [74.0, 17.0]]},
        {"name": "Route"}
    )
    
    # Polygon
    poly_layer = map_repo.create_from_geojson(
        run.id, "polygon",
        {"type": "Polygon", "coordinates": [[[73.0, 16.0], [74.0, 16.0], [74.0, 17.0], [73.0, 17.0], [73.0, 16.0]]]},
        {"name": "Hazard Zone"}
    )
    
    layers = map_repo.get_by_run_id(run.id)
    assert len(layers) == 3

def test_transaction_rollback(db_session):
    repo = ConversationRepository(db_session)
    thread_id = str(uuid.uuid4())
    repo.create(thread_id, {})
    
    # Force a rollback by violating unique constraint
    with pytest.raises(IntegrityError):
        repo.create(thread_id, {})
        
    # The session is rolled back, we can continue using it normally if we start a new sub-transaction,
    # but SQLAlchemy raises an error until rolled back explicitly or at the end of the context manager.
    # In our repository, the .create() catches IntegrityError and calls session.rollback() then raises.
    # Because session.rollback() was called inside .create(), the session is clean again!
    thread_id2 = str(uuid.uuid4())
    thread2 = repo.create(thread_id2, {})
    assert thread2.thread_id == thread_id2

def test_duplicate_id_handling(db_session):
    repo = ConversationRepository(db_session)
    thread_id = str(uuid.uuid4())
    repo.create(thread_id, {})
    with pytest.raises(IntegrityError):
        repo.create(thread_id, {})

def test_invalid_geometry(db_session):
    conv_repo = ConversationRepository(db_session)
    run_repo = RunRepository(db_session)
    map_repo = MapLayerRepository(db_session)
    
    thread_id = str(uuid.uuid4())
    conv_repo.create(thread_id, {})
    run = run_repo.create(thread_id, {})
    
    with pytest.raises(Exception):
        map_repo.create_from_geojson(
            run.id, "invalid",
            {"type": "InvalidType", "coordinates": []},
            {}
        )

def test_thread_isolation(db_session):
    repo = ConversationRepository(db_session)
    t1 = repo.create("thread1", {})
    t2 = repo.create("thread2", {})
    
    assert t1.id != t2.id
    assert repo.get_by_thread_id("thread1") is not None
    assert repo.get_by_thread_id("thread2") is not None
