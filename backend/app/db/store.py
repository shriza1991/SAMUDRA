"""SQLAlchemy Conversation Store Adapter.

Owned by Dev 2 (Backend Platform).
Fulfills the Dev 3 ConversationStore interface using the SQLAlchemy Repositories.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from backend.app.agents.memory import ConversationStore, ThreadContext
from backend.app.db.session import SessionLocal
from backend.app.db.repositories import ConversationRepository

logger = logging.getLogger(__name__)


class SQLAlchemyConversationStore(ConversationStore):
    """PostgreSQL conversation store adapter using SQLAlchemy synchronous connections.

    Fulfills the Dev 3 ConversationStore contract exactly, ensuring no async
    connections leak into the agent thread.
    """

    def __init__(self):
        pass

    def get_thread(self, thread_id: str) -> Optional[ThreadContext]:
        with SessionLocal() as session:
            repo = ConversationRepository(session)
            thread = repo.get_by_thread_id(thread_id)
            if thread:
                return ThreadContext.model_validate(thread.context_json)
            return None

    def save_thread(self, thread: ThreadContext) -> None:
        context_json = thread.model_dump(mode="json")
        with SessionLocal() as session:
            repo = ConversationRepository(session)
            db_thread = repo.get_by_thread_id(thread.thread_id)
            if db_thread:
                # Update existing
                repo.update(thread.thread_id, context_json)
            else:
                # Create new
                repo.create(thread.thread_id, context_json, thread.schema_version)

    def update_thread(self, thread_id: str, updates: Dict[str, Any]) -> ThreadContext:
        ctx = self.get_thread(thread_id) or ThreadContext(thread_id=thread_id)
        data = ctx.model_dump()
        data.update(updates)
        data["last_updated_at"] = datetime.now(timezone.utc).isoformat()
        
        updated_thread = ThreadContext.model_validate(data)
        self.save_thread(updated_thread)
        return updated_thread

    def delete_thread(self, thread_id: str) -> bool:
        with SessionLocal() as session:
            repo = ConversationRepository(session)
            return repo.delete(thread_id)

    def exists(self, thread_id: str) -> bool:
        with SessionLocal() as session:
            repo = ConversationRepository(session)
            return repo.get_by_thread_id(thread_id) is not None
