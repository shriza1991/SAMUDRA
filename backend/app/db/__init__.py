"""Database Package for SAMUDRA.

Owned by Dev 2 (Backend Platform).
Provides async SQLAlchemy engine factory and declarative base.
"""

from backend.app.db.session import AsyncSessionLocal, engine, get_db
from backend.app.db.base import Base

__all__ = ["AsyncSessionLocal", "engine", "get_db", "Base"]
