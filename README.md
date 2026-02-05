# scope3-execution

End-to-end Scope 3 “Measure → Reduce → Engage” demo system with audit-friendly evidence and quality controls.

- Backend: FastAPI + MongoDB (Motor), with a mock batch pipeline and evidence/provenance primitives.
- Frontend: Create React App (CRACO) + Tailwind UI that drives the core workflows.

## Quickstart (local)

### Prereqs

- Python 3.10+ (works with `python3 -m venv`)
- Node.js 18+ plus either `yarn` or `npm`
- A reachable MongoDB (local or remote)

### 1) Configure environment

Backend reads `backend/.env` (loaded from `backend/server.py`):

```bash
cat > backend/.env <<'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=scope3_execution

# Required for encrypted PDF storage + rendered page caching
DOCSTORE_KEY=__GENERATE_ME__

# Optional: real OCR / LLM-backed extraction (Evidence → OCR).
# If unset, the app falls back to deterministic pseudo-blocks so the Evidence UI remains testable.
EMERGENT_LLM_KEY=__OPTIONAL__

# Comma-separated origins allowed for browser credentialed requests (prod should be explicit)
# CORS_ORIGINS=https://app.example.com,https://admin.example.com
EOF
```

Generate a `DOCSTORE_KEY`:

```bash
python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

Frontend reads `frontend/.env` (CRA requires the `REACT_APP_` prefix):

```bash
cat > frontend/.env <<'EOF'
REACT_APP_BACKEND_URL=http://localhost:8000
EOF
```

### 2) Install deps

```bash
make setup
```

### 3) Run backend + frontend

Backend (from repo root):

```bash
cd backend
../.venv/bin/python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Frontend (new shell):

```bash
cd frontend
yarn start  # or: npm start
```

Open `http://localhost:3000`.

#### Local auth note (important)

The backend sets `Secure; SameSite=None` cookies (required for cross-site XHR in production). Browsers will not set `Secure` cookies over plain `http`.

For local development, use one of:

- Run the backend behind HTTPS (recommended; e.g. `ngrok http 8000`) and set `REACT_APP_BACKEND_URL` to the HTTPS URL.
- Use the dev/test login flow for API testing (see `TEST_MODE` below) instead of the browser UI.

## Environment variables

### Backend (`backend/.env`)

Required:

- `MONGO_URL`: Mongo connection string.
- `DB_NAME`: Database name (per environment).

Feature-gated / optional:

- `DOCSTORE_KEY`: Fernet key used to encrypt stored PDFs and rendered page images on disk. Required for `POST /api/pipeline/docs/upload`.
- `EMERGENT_LLM_KEY`: API key for OCR / block extraction calls (optional; falls back to deterministic pseudo-blocks).

Deployment / ops:

- `CORS_ORIGINS`: Comma-separated list of allowed origins for credentialed browser requests (set explicitly in production).

Test-only:

- `TEST_MODE=true`: Enables `POST /api/auth/test-login`.
- `TEST_AUTH_TOKEN`: Shared secret expected in the `X-Test-Auth` header for `/api/auth/test-login`.

### Frontend (`frontend/.env`)

- `REACT_APP_BACKEND_URL`: Base URL of the backend (the app builds `.../api/*` paths from this).

## Core workflows

### Pipeline (batch)

The system models a “nightly” pipeline that seeds baseline (Measure), ingests peer disclosures (Evidence), and generates cached recommendations (Reduce).

- Run everything (demo): `POST /api/pipeline/run?period=last_12_months`
- Granular stages:
  - Sources: `POST /api/pipeline/sources/register` / `POST /api/pipeline/sources/seed`
  - Download: `POST /api/pipeline/download`
  - Ingest/chunk: `POST /api/pipeline/ingest`
  - Generate recs: `POST /api/pipeline/generate`
- Observability: `GET /api/admin/metrics` (counts + last run), `GET /api/admin/audit` (audit trail)

### Evidence & provenance (auditability)

Evidence is stored as encrypted PDFs on disk (`backend/disclosure_docs/`) with derived artifacts (rendered pages, OCR blocks). Field-level provenance ties specific business fields to evidence locations.

- Upload and manage docs:
  - List: `GET /api/pipeline/docs`
  - Upload (encrypted): `POST /api/pipeline/docs/upload` (requires `DOCSTORE_KEY`)
  - Delete: `DELETE /api/pipeline/docs/{doc_id}`
- Render + OCR (Evidence UI uses these):
  - Render a PDF page: `POST /api/execution/render-pdf-page`
  - Render & store a page image: `POST /api/execution/render-and-store-page`
  - OCR a page image into blocks: `POST /api/execution/ocr` (real OCR requires `EMERGENT_LLM_KEY`; otherwise returns deterministic pseudo-blocks)
  - List stored OCR blocks: `GET /api/execution/ocr-blocks?doc_id=...&page_number=...`
- Provenance:
  - Create: `POST /api/execution/field-provenance`
  - List: `GET /api/execution/field-provenance?entity_type=...&entity_id=...`
  - Delete: `DELETE /api/execution/field-provenance/{provenance_id}`

### Quality (controls & anomaly triage)

Quality checks are deterministic (no LLM required) and focus on audit-readiness: missing provenance on high-impact fields, insufficient evidence context for a recommendation, pipeline hygiene, etc.

- Run scan: `POST /api/quality/anomalies/run`
- List anomalies: `GET /api/quality/anomalies?status=open|ignored|resolved&severity=low|medium|high`
- Update status: `POST /api/quality/anomalies/{anomaly_id}/status`

### Reporting period locks (immutability)

Mutating workflows enforce “period locks” so that once a reporting window is finalized, inputs and derived outputs cannot be changed.

- Create/open lock record: `POST /api/execution/reporting-period-locks` (status defaults to `open`)
- List locks: `GET /api/execution/reporting-period-locks`
- Lock a period: `POST /api/execution/reporting-period-locks/{period}/lock`

When a period is locked, mutating endpoints return `423 Locked` (e.g. pipeline runs, measure seeding, doc uploads).

### Integrations (vendor outreach demo)

The Integrations module provides **hardcoded, demo-only connector flows** for popular procurement/ERP/travel/logistics tools.
Connecting a tool and running “Demo sync” deterministically seeds Measure input rows (spend + activity) so downstream Measure/Reduce views light up.

- Catalog: `GET /api/integrations/catalog`
- State: `GET /api/integrations/state`, `POST /api/integrations/state`
- Demo sync: `POST /api/integrations/{connector_id}/demo-sync?period=...`

## Testing / CI

CI entrypoint:

```bash
make ci
```

This runs `scripts/ci.sh`, which:

- Creates `.venv/` and installs `backend/requirements.txt`
- Runs `pytest` (repo-level)
- Installs frontend deps (yarn preferred; npm supported) and runs `frontend` build

Useful targets:

- `make backend-setup`
- `make backend-test`
- `make frontend-setup`
- `make frontend-build`

## Docs

- Agent/dev conventions: `AGENTS.md`
- Consultant readiness checklist: `docs/PRODUCTION_READINESS.md`
- Product spec snapshot: `memory/PRD.md`
- Evidence-first build plan: `memory/SCOPE3_OCR_ORCHESTRATOR_PLAN.md`
- Auth playbook (test mode + cookies): `auth_testing.md`
- Image/OCR testing playbook: `image_testing.md`
- Test protocol + history log: `test_result.md`
- Demo video assets (Remotion): `demo/remotion/README.md`

## Architecture notes

- **Backend** (`backend/server.py`): monolith FastAPI app with `/api` router, Mongo persistence, and lightweight “pipeline” endpoints that simulate batch compute.
- **Storage**: PDFs and rendered pages are encrypted on disk with Fernet when `DOCSTORE_KEY` is set; metadata and derived records live in Mongo.
- **Evidence model**: disclosure docs → rendered pages → OCR blocks → field provenance (entity/field pointers to doc/page/bbox/block ids).
- **Quality model**: anomalies are upserted and triaged via status; audit events are emitted for critical state changes.
