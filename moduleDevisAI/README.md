# AI Quotation Module

The **AI Quotation Module** (`moduleDevisAI`) is an intelligent, autonomous subsystem engineered to streamline and automate quotation generation in the construction (BTP) industry. Integrated within the company's enterprise CRM, it empowers general contractors, quantity surveyors, and site managers to seamlessly convert unstructured field inputs-voice memos, site photos, and raw notes-into structured, catalogue-grounded, cost-audited quotations exportable to official PDF documents.

### Key Capabilities
- **Three-Dimensional Multimodal Ingestion:**
  - **Freeform Text:** Direct entry or paste of construction scopes and specifications.
  - **Voice Memos:** In-browser audio capture with real-time waveform visualization, transcribed via Whisper (Groq / OpenAI) primed with a specialized construction vocabulary.
  - **Construction Site Photos:** Drag-and-drop uploader, client-side validation (JPEG/PNG ≤ 10 MB), automatic room identification, metric surface area estimation with confidence scores, and multi-class material detection via vision models (Gemini Flash).
- **Hybrid RAG & Grounded Catalogue Matching:**
  - Hybrid retrieval fusing PostgreSQL Full-Text Search (French language morphology) and semantic vector search (`pgvector` with HNSW indexing).
  - Reciprocal Rank Fusion (**RRF**) ranking.
  - LLM-assisted candidate selection under **strict financial isolation** (the LLM never accesses or hallucinates prices, unit costs, or profit margins).
- **Deterministic Financial Engine:**
  - Bill of Materials (BOM / *sous-détail de prix*) decomposition into elementary materials and labor hours.
  - Real-time computation of pre-tax revenue (HT), VAT (TVA), gross totals (TTC), cost of goods sold (COGS), and profit margins in EUR and percentage.
  - Automated threshold alerts for margin anomalies (< 15% or > 40%).
- **Interactive Review & Fine-Tuning:**
  - Dynamic line item quantity and pricing adjustments.
  - Addition of complementary catalog services directly within the UI.
  - Granular breakdown and editing of sub-components.
- **Official PDF Generation & Audit Trail (Snapshots):**
  - Production of industry-standard, print-ready PDF quotations via ReportLab conforming to French construction invoicing requirements.
  - Immutable JSONB snapshot persistence (`quotation_snapshots`) stored in PostgreSQL for legal traceability and historical integrity.

## 2. System Architecture

```mermaid
flowchart TD
    subgraph Inputs ["1. Multimodal Inputs"]
        A1["📝 Free Text Scope"]
        A2["🎙️ Audio Memo (Voice)"]
        A3["📸 Site Photo (Vision)"]
    end

    subgraph Adapters ["2. Tool Registry (AI Adapters)"]
        B1["Groq / OpenAI (Whisper)"]
        B2["Google Gemini (Vision & Text)"]
        B3["Anthropic Claude / OpenAI GPT-4o"]
    end

    subgraph Preprocessing ["3. Normalization & Hybrid RAG"]
        C1["Quantity & Intent Extraction"]
        C2["Hybrid Search RRF\n(pgvector HNSW + PostgreSQL FTS)"]
        C3["Grounded LLM Selection\n(Isolated from financial data)"]
    end

    subgraph PricingEngine ["4. Deterministic Financial Engine"]
        D1["Bill of Materials Decomposition\n(Materials & Labor)"]
        D2["Revenue, Cost & Margin Math (EUR, %)"]
        D3["Margin Anomaly Alerts"]
    end

    subgraph OutputReview ["5. Review & Finalization"]
        E1["React 19 Interface\n(Live quantity & BOM adjustments)"]
        E2["Immutable Snapshot Persistence (JSONB)"]
        E3["Official PDF Export (ReportLab)"]
    end

    A1 --> C1
    A2 --> B1 --> C1
    A3 --> B2 --> C1
    C1 --> C2 --> C3
    C3 --> D1 --> D2 --> D3
    D3 --> E1
    E1 --> E2
    E1 --> E3
```

## 3. Directory Layout (`moduleDevisAI/`)

```text
moduleDevisAI/
├── api/                           # FastAPI Application Layer
│   ├── main.py                    # Service entry point and middleware configuration
│   ├── routes.py                  # REST API endpoints (photo, audio, matching, pdf, catalog)
│   └── prompt_loader.py           # Cached system prompt loader
├── catalog/                       # Hybrid Retrieval & RAG Layer
│   ├── embeddings.py              # Embedding generation (EmbeddingGemma, sentence-transformers)
│   ├── hybrid_retriever.py        # Tenant-isolated RRF engine (PostgreSQL FTS + pgvector)
│   └── indexer.py                 # Batch vector indexing pipeline
├── database/                      # SQL Schemas, Seeds & Indexing Scripts
│   ├── migrations/                # DDL migration scripts (pgvector, tables, GIN & HNSW indexes)
│   ├── seed_demo_catalogue.sql    # Representative construction catalog (services & components)
│   └── index_catalogue.py         # CLI vector indexing utility
├── devis/                         # Core Domain Logic & Financial Engine
│   ├── financial_service.py       # Deterministic calculation of totals, costs, margins & alerts
│   ├── matching.py                # Grounded candidate filtering and financial isolation
│   ├── catalogue_pricing.py       # BOM and sub-component cost rollups
│   ├── pdf_export.py              # Professional vector PDF renderer (ReportLab)
│   ├── snapshots.py               # Immutable snapshot repository for historical audit
│   └── text.py                    # String normalization and formatting
├── frontend/                      # React 19 + Vite User Interface
│   ├── src/
│   │   ├── components/            # PhotoUpload, QuoteReview, QuoteLine, ComponentEditor
│   │   ├── VoiceRecorder.jsx      # Audio recorder with live canvas visualizer
│   │   ├── App.jsx                # Multimodal workflow orchestrator
│   │   └── styles.css             # Responsive styles and design system
│   ├── package.json               # Frontend dependencies (React 19, Lucide, Vite)
│   └── vite.config.js             # Vite configuration with API proxying
├── prompts/                       # Production-Tuned System Prompts
│   ├── audio_transcription_prompt.txt
│   ├── vision_analysis_system_prompt.txt
│   └── quote_selection_system_prompt.txt
├── toolregistry/                  # Multi-Provider Adapter Pattern Architecture
│   ├── base.py                    # Abstract protocols (Text, Vision, Transcription)
│   ├── registry.py                # Dynamic adapter factory
│   ├── google_adapter.py          # Google GenAI adapter (Gemini Flash, thinking budget control)
│   ├── openai_adapter.py          # OpenAI adapter (GPT-4o, Whisper)
│   ├── groq_adapter.py            # Groq adapter (Whisper Large v3 Turbo)
│   ├── anthropic_adapter.py       # Anthropic adapter (Claude 3.5 Sonnet)
│   ├── config.py                  # Strongly typed environment configuration
│   └── logging_config.py          # Structured JSON audit logging
├── benchmark/                     # Scientific Model Evaluation Suite
│   ├── benchmark_vocal.py         # Audio benchmark (WER, construction terms, cost, latency)
│   ├── benchmark_vision.py        # Vision benchmark (surface accuracy, material detection, cost)
│   ├── data/                      # Benchmark test assets (OGG audios, JPG site photos)
│   └── results/                   # Comparative evaluation summaries (CSV)
├── docs/                          # In-Depth Technical Documentation
│   ├── ARCHITECTURE.md            # System architecture and design choices
│   ├── API_REFERENCE.md           # Full OpenAPI REST endpoint specification
│   └── BENCHMARK_REPORT.md        # Audio and vision benchmark findings
├── Dockerfile                     # Container definition for FastAPI backend
├── docker-compose.yml             # Orchestration for PostgreSQL/pgvector & FastAPI
└── requirements.txt               # Strict Python dependencies
```

## 4. Quickstart Guide

### Prerequisites
- Python 3.12+ (in a virtual environment)
- Node.js 18+ and npm
- Docker & Docker Compose (for PostgreSQL + pgvector)

### A. Launch the Database
```bash
cd moduleDevisAI
docker compose up -d postgres
```
PostgreSQL will start on port `55432` with the `vector` extension enabled and initial migrations applied.

To seed the demo catalog and generate vector embeddings:
```bash
# Seed synthetic construction services and materials
docker compose exec postgres psql -U devis_ai -d catalog -f /docker-entrypoint-initdb.d/../database/seed_demo_catalogue.sql

# Compute embeddings and populate HNSW vector index
python database/index_catalogue.py --company-id 1
```

### B. Configure Backend Environment
Create a `.env` file at the root of `moduleDevisAI/` based on `.env.example`:
```env
DATABASE_URL=postgresql://devis_ai:devis_ai_dev@localhost:55432/catalog
TOOLREGISTRY_PROVIDER=google
GOOGLE_API_KEY=your_google_api_key_here
GROQ_API_KEY=your_groq_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_THINKING_BUDGET=0
TOOLREGISTRY_MAX_OUTPUT_TOKENS=4096
```

Install Python packages and start FastAPI:
```bash
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

### C. Launch the Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5174` in your browser.

## 6. Detailed Technical Documentation

To explore specific areas of the module, refer to the documentation suite in [`docs/`](./docs/):
- [**Architecture & System Design**](./docs/ARCHITECTURE.md): Conceptual model, hybrid RAG, financial isolation, and design patterns.
- [**REST API Reference**](./docs/API_REFERENCE.md): Detailed specifications for every endpoint, schema, and error response.
- [**Model Benchmark Report**](./docs/BENCHMARK_REPORT.md): Empirical evaluation of audio and vision models on real-world construction data.
