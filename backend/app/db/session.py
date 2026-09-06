"""Async SQLAlchemy Session Factory for SAMUDRA.

Owned by Dev 2 (Backend Platform).

Creates a single async engine from DATABASE_URL and exposes:
- `engine`            — AsyncEngine (used in migrations and startup checks)
- `AsyncSessionLocal` — sessionmaker bound to the engine
- `get_db`            — FastAPI dependency yielding an async session

The engine is created lazily; if the database is unavailable at startup the
application still starts in SNAPSHOT mode without crashing.
"""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.app.core.config import settings


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

# echo=False in production; SQLAlchemy logs are too verbose for demo mode.
# pool_pre_ping ensures stale connections are detected before use.
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session, closing it on exit.

    Usage::

        @router.get("/example")
        async def example(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
