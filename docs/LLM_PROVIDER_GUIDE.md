# Developer Guide: LLM Provider Configuration & Local Deployment

**Owner**: Dev 3 (Agent Orchestration & Explainability)  
**SIH Problem Statement**: PS 26176 — ORCA: Marine EcOsystem Reasoning with Collaborative Agents  

---

## 1. Overview

SAMUDRA / ORCA uses a provider-agnostic LLM interface (`LLMProvider`). The application is designed to operate seamlessly across three environments without code changes:
1. **Offline CI/CD and Local Testing**: Using `FakeLLMProvider` (100% offline, zero external dependencies, zero latency, free).
2. **Local Production / Edge Deployment**: Using `OllamaLLMProvider` with open-weights models such as Llama 3, Mistral, or Qwen (100% free, runs locally on GPU/CPU, full data sovereignty for maritime authorities).
3. **Cloud Evaluation / High-Throughput Endpoints**: Using `OpenAILLMProvider` (OpenAI, Azure OpenAI, vLLM, or self-hosted TGI).

---

## 2. Environment Configuration

LLM behavior is configured via environment variables (or `.env`):

```bash
# Provider selection: 'fake' | 'ollama' | 'openai'
LLM_PROVIDER=ollama

# Model Identifier
LLM_MODEL=llama3:8b

# Ollama Endpoint (defaults to http://localhost:11434)
OLLAMA_BASE_URL=http://localhost:11434

# OpenAI / vLLM Endpoint (optional)
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_API_KEY=your-api-key-if-using-openai

# Request timeout in seconds
LLM_TIMEOUT_SECONDS=10.0
```

---

## 3. Local Deployment with Ollama (Recommended Free Setup)

To run SAMUDRA locally with a real open-weights model:

### Step 1: Install Ollama
Download and install Ollama from [https://ollama.ai](https://ollama.ai).

### Step 2: Pull a Recommended Model
For maritime query reasoning and multilingual extraction:
```bash
# Recommended lightweight model (runs smoothly on 8GB RAM / 4GB VRAM)
ollama pull llama3:8b

# Or lightweight instruction-tuned model
ollama pull mistral:7b
```

### Step 3: Verify Ollama Service
Ensure the Ollama daemon is running:
```bash
curl http://localhost:11434/api/tags
```

### Step 4: Configure SAMUDRA
Set in your `.env`:
```ini
LLM_PROVIDER=ollama
LLM_MODEL=llama3:8b
OLLAMA_BASE_URL=http://localhost:11434
```

When you start the SAMUDRA backend (`uvicorn backend.app.main:app`), it will automatically connect to your local Ollama instance. If Ollama is offline or experiences an error, SAMUDRA automatically falls back to deterministic rules.

---

## 4. Offline Testing with FakeLLMProvider

In testing and CI pipelines, no external process or network is required.

### Basic In-Memory Testing
```python
from backend.app.agents.graph import run_orca_graph
from backend.app.agents.llm import FakeLLMProvider

# Instant, deterministic execution
fake_llm = FakeLLMProvider()
state = run_orca_graph(
    user_message="Where is the nearest PFZ?",
    llm_provider=fake_llm,
    tool_mode="contract_mock",
)
print(state["response"])
```

### Simulating Errors & Fault Injection
You can easily simulate real-world failure cases:
```python
# Simulate request timeout
timeout_llm = FakeLLMProvider(simulate_timeout=True)

# Simulate model crash
crashing_llm = FakeLLMProvider(simulate_failure=True)

# Simulate invalid JSON
malformed_llm = FakeLLMProvider(simulate_malformed=True)
```
In each case, SAMUDRA's LangGraph nodes catch the failure, log a degraded telemetry trace item, and fall through cleanly to deterministic fallback rules.

---

## 5. Adding a Custom LLM Provider

To connect a new LLM inference engine:
1. Inherit from `LLMProvider` in `backend/app/agents/llm.py`:
```python
class CustomLLMProvider(LLMProvider):
    @property
    def provider_name(self) -> str:
        return "custom"

    @property
    def model_name(self) -> str:
        return "custom-marine-model"

    def generate(self, messages, temperature=0.0, max_tokens=1024, timeout_seconds=None):
        # Implement text generation
        ...

    def generate_structured(self, messages, response_schema, temperature=0.0, timeout_seconds=None):
        # Implement structured Pydantic model validation
        ...
```
2. Add the custom provider to `get_llm_provider()` in `backend/app/agents/llm.py`.
