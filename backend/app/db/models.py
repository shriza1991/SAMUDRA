"""Database ORM models.

Owned by Dev 2 (Backend Platform).
Provides SQLAlchemy declarative models mapped to PostgreSQL with PostGIS support.
"""

from datetime import datetime, timezone
import uuid
import enum

from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry

from backend.app.db.session import Base

def utcnow():
    return datetime.now(timezone.utc)


class ConversationThread(Base):
    __tablename__ = "conversation_threads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id = Column(String, unique=True, index=True, nullable=False)
    context_json = Column(JSONB, nullable=False, default={})
    schema_version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    runs = relationship("Run", back_populates="thread", cascade="all, delete-orphan")


class RunStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class Run(Base):
    __tablename__ = "runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    thread_id = Column(String, ForeignKey("conversation_threads.thread_id", ondelete="CASCADE"), nullable=False)
    run_status = Column(Enum(RunStatus), nullable=False, default=RunStatus.PENDING)
    started_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(String, nullable=True)
    metadata_json = Column(JSONB, nullable=False, default={})

    thread = relationship("ConversationThread", back_populates="runs")
    evidence_items = relationship("EvidenceItem", back_populates="run", cascade="all, delete-orphan")
    map_layers = relationship("MapLayer", back_populates="run", cascade="all, delete-orphan")


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    source = Column(String, nullable=False)
    raw_data = Column(JSONB, nullable=False, default={})
    extracted_entities = Column(JSONB, nullable=False, default={})
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    run = relationship("Run", back_populates="evidence_items")


class MapLayer(Base):
    __tablename__ = "map_layers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    layer_type = Column(String, nullable=False)
    geometry = Column(Geometry(geometry_type="GEOMETRY", srid=4326), nullable=False)
    properties = Column(JSONB, nullable=False, default={})
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    run = relationship("Run", back_populates="map_layers")


class ConnectorSnapshot(Base):
    __tablename__ = "connector_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_name = Column(String, nullable=False, index=True)
    payload = Column(JSONB, nullable=False)
    validity_window = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class ConnectorStatus(Base):
    __tablename__ = "connector_status"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_name = Column(String, unique=True, nullable=False, index=True)
    is_online = Column(Boolean, default=False, nullable=False)
    last_checked = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    error_state = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
