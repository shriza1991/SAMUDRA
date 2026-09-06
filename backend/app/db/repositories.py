"""Data repositories.

Owned by Dev 2 (Backend Platform).
Encapsulates SQLAlchemy queries and transaction lifecycle.
"""

from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from backend.app.db.models import (
    ConversationThread,
    Run,
    RunStatus,
    EvidenceItem,
    MapLayer,
    ConnectorSnapshot,
    ConnectorStatus,
)


class BaseRepository:
    def __init__(self, session: Session):
        self.session = session


class ConversationRepository(BaseRepository):
    def get_by_thread_id(self, thread_id: str) -> Optional[ConversationThread]:
        return self.session.query(ConversationThread).filter_by(thread_id=thread_id).first()

    def create(self, thread_id: str, context_json: Dict[str, Any], schema_version: int = 1) -> ConversationThread:
        thread = ConversationThread(
            thread_id=thread_id,
            context_json=context_json,
            schema_version=schema_version,
        )
        self.session.add(thread)
        try:
            self.session.commit()
            self.session.refresh(thread)
            return thread
        except SQLAlchemyError:
            self.session.rollback()
            raise

    def update(self, thread_id: str, context_json: Dict[str, Any]) -> Optional[ConversationThread]:
        thread = self.get_by_thread_id(thread_id)
        if thread:
            thread.context_json = context_json
            try:
                self.session.commit()
                self.session.refresh(thread)
            except SQLAlchemyError:
                self.session.rollback()
                raise
        return thread

    def delete(self, thread_id: str) -> bool:
        thread = self.get_by_thread_id(thread_id)
        if thread:
            try:
                self.session.delete(thread)
                self.session.commit()
                return True
            except SQLAlchemyError:
                self.session.rollback()
                raise
        return False


class RunRepository(BaseRepository):
    def get_by_id(self, run_id: uuid.UUID) -> Optional[Run]:
        return self.session.query(Run).filter_by(id=run_id).first()

    def create(self, thread_id: str, metadata_json: Dict[str, Any] = None) -> Run:
        run = Run(
            thread_id=thread_id,
            metadata_json=metadata_json or {},
            run_status=RunStatus.PENDING,
        )
        self.session.add(run)
        try:
            self.session.commit()
            self.session.refresh(run)
            return run
        except SQLAlchemyError:
            self.session.rollback()
            raise

    def update_status(self, run_id: uuid.UUID, status: RunStatus, error_message: str = None) -> Optional[Run]:
        run = self.get_by_id(run_id)
        if run:
            run.run_status = status
            if error_message:
                run.error_message = error_message
            try:
                self.session.commit()
                self.session.refresh(run)
            except SQLAlchemyError:
                self.session.rollback()
                raise
        return run


class EvidenceRepository(BaseRepository):
    def create(self, run_id: uuid.UUID, source: str, raw_data: dict, extracted_entities: dict) -> EvidenceItem:
        item = EvidenceItem(
            run_id=run_id,
            source=source,
            raw_data=raw_data,
            extracted_entities=extracted_entities,
        )
        self.session.add(item)
        try:
            self.session.commit()
            self.session.refresh(item)
            return item
        except SQLAlchemyError:
            self.session.rollback()
            raise


class MapLayerRepository(BaseRepository):
    def create_from_geojson(self, run_id: uuid.UUID, layer_type: str, geojson_geom: dict, properties: dict) -> MapLayer:
        from geoalchemy2.shape import from_shape
        from shapely.geometry import shape

        geom = shape(geojson_geom)
        wkb_geom = from_shape(geom, srid=4326)

        layer = MapLayer(
            run_id=run_id,
            layer_type=layer_type,
            geometry=wkb_geom,
            properties=properties,
        )
        self.session.add(layer)
        try:
            self.session.commit()
            self.session.refresh(layer)
            return layer
        except SQLAlchemyError:
            self.session.rollback()
            raise

    def get_by_run_id(self, run_id: uuid.UUID) -> List[MapLayer]:
        return self.session.query(MapLayer).filter_by(run_id=run_id).all()


class ConnectorSnapshotRepository(BaseRepository):
    def create(self, source_name: str, payload: dict, validity_window: str = None) -> ConnectorSnapshot:
        snap = ConnectorSnapshot(
            source_name=source_name,
            payload=payload,
            validity_window=validity_window,
        )
        self.session.add(snap)
        try:
            self.session.commit()
            self.session.refresh(snap)
            return snap
        except SQLAlchemyError:
            self.session.rollback()
            raise


class ConnectorStatusRepository(BaseRepository):
    def upsert_status(self, source_name: str, is_online: bool, error_state: str = None) -> ConnectorStatus:
        status = self.session.query(ConnectorStatus).filter_by(source_name=source_name).first()
        if not status:
            status = ConnectorStatus(source_name=source_name)
            self.session.add(status)
        
        status.is_online = is_online
        status.error_state = error_state
        
        try:
            self.session.commit()
            self.session.refresh(status)
            return status
        except SQLAlchemyError:
            self.session.rollback()
            raise
