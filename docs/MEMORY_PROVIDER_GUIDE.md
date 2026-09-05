# Developer Guide: ConversationStore Configuration & Backend Deployment

**Owner**: Dev 3 (Agent Orchestration & Explainability)  
**SIH Problem Statement**: PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  

---

## 1. Overview

SAMUDRA / ORCA uses a provider-agnostic conversation persistence interface (`ConversationStore`) decoupled from specific storage engines. The system supports three backends:
1. **`InMemoryConversationStore`**: Default zero-configuration backend for unit tests, offline development, and demonstrations.
2. **`PostgreSQLConversationStore`**: Production durable storage storing JSONB context into PostgreSQL.
3. **`RedisConversationStore`**: Fast session cache with automatic TTL expiration.

---

## 2. Configuration Options

Set the memory backend via environment variables (or `.env`):

```bash
# Memory Backend: 'memory' | 'postgres' | 'redis'
MEMORY_BACKEND=memory

# PostgreSQL connection string (if using postgres)
DATABASE_URL=postgresql+asyncpg://samudra_user:password@localhost:5432/samudra_db

# Redis connection settings (if using redis)
REDIS_URL=redis://localhost:6379/0
REDIS_SESSION_TTL_SECONDS=86400
```

---

## 3. Storage Adapters

### A. In-Memory Store (`InMemoryConversationStore`)
- Requires no installation or network.
- Uses deepcopy isolation and JSON serialization fidelity to guarantee thread safety.
- Ideal for automated testing and CI/CD pipelines.

### B. PostgreSQL Store (`PostgreSQLConversationStore`)
- Stores context into the `conversation_threads` table owned by Dev 2:
```sql
CREATE TABLE IF NOT EXISTS conversation_threads (
    thread_id VARCHAR(128) PRIMARY KEY,
    context_json JSONB NOT NULL,
    schema_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_updated ON conversation_threads(updated_at);
```
- Dev 3 interfaces with this table using clean adapter contracts.

### C. Redis Store (`RedisConversationStore`)
- Stores context as serialized JSON under the key format: `samudra:thread:{thread_id}`.
- Supports automatic expiration (default: 24 hours).

---

## 4. Implementing a Custom Store

To add a new backend (e.g. DynamoDB, MongoDB):
1. Inherit from `ConversationStore` in `backend/app/agents/memory.py`:
```python
class CustomConversationStore(ConversationStore):
    def get_thread(self, thread_id: str) -> Optional[ThreadContext]: ...
    def save_thread(self, thread: ThreadContext) -> None: ...
    def update_thread(self, thread_id: str, updates: Dict[str, Any]) -> ThreadContext: ...
    def delete_thread(self, thread_id: str) -> bool: ...
    def exists(self, thread_id: str) -> bool: ...
```
2. Configure `MemoryManager` to use your custom store:
```python
memory_manager.set_store(CustomConversationStore())
```

---

## 5. Security, Privacy & Data Minimization Guidelines

When extending or customizing `ConversationStore`:
- **Never Persist Secrets**: Passwords, tokens, and API keys must be stripped via `memory_manager.sanitize_context_data()`.
- **Never Persist Raw CoT**: Private chain-of-thought or model scratchpads must never be written to persistent context.
- **Never Freeze Domain Outputs**: Past wave heights and risk determinations (`NO_GO`, `CAUTION`, `GO`) must **never** be stored as permanent facts. Fresh domain data must be queried on every turn.
