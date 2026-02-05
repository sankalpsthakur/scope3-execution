# Scope 3 Reduce + MRV Platform — Evidence-First Architecture & Build Plan (GPT‑5.2 Tool-Calling)

**Decision:** Use GPT‑5.2 for **(A) narrative + decision routing (tool calling) only**. The LLM must **never** invent numbers. All numeric outputs (tCO₂e, intensities, deltas, totals, % reductions) come only from deterministic tools (OCR/extraction/compute).

## Current status (as of 2026-02-06)

Implemented thin-slices that make the Evidence + Quality loop testable end-to-end:

- Evidence Library (MVP):
  - Upload encrypted PDFs: `POST /api/pipeline/docs/upload`
  - Render PDF pages: `POST /api/execution/render-pdf-page`
  - Render & store page images: `POST /api/execution/render-and-store-page`
  - OCR blocks extraction: `POST /api/execution/ocr`
  - List OCR blocks for overlays: `GET /api/execution/ocr-blocks`
  - Field provenance store/list/delete: `POST|GET|DELETE /api/execution/field-provenance*`
- Quality (MVP):
  - Anomaly scan + queue: `POST /api/quality/anomalies/run`, `GET /api/quality/anomalies`
  - Fix-queue actions: `POST /api/quality/anomalies/{id}/status` (open/ignored/resolved)
  - Missing evidence detection for high-impact benchmark fields: `provenance.missing.*` anomalies
- Reporting period locks (MVP):
  - Manage locks: `POST|GET /api/execution/reporting-period-locks`, `POST /api/execution/reporting-period-locks/{period}/lock`
  - Enforced with `423 Locked` on key write endpoints when locked
- Report module: audit-ready dashboard aggregating Measure + Engage + Quality + Audit data
- Integrations catalog: 17 connectors with demo-sync flows
- Render deployment: single-service at https://scope3-execution.onrender.com

Remaining: structured extraction templates beyond OCR blocks, deterministic computation pipeline for uploaded supplier docs, and assurance-grade report exports.

---

## 1) Executive summary (layman-friendly)

### What this platform does
This platform helps a procurement team reduce Scope 3 emissions by turning messy documents and disclosures into:
- a **ranked list** of the highest-impact supplier actions,
- **peer-validated proof** (leader vs laggard) with exact citations,
- **supplier evidence checklists** (what to request, what to upload),
- **verified calculations** (Measure + MRV),
- and an **assurance appendix** (provenance + anomalies + methodology) for audit/assurance.

### The trust rule (“numbers only from tools”)
- The LLM (GPT‑5.2) can decide **what to do next** (which extraction template, what questions to ask, what narrative to write).
- The LLM **cannot** create numeric values.
- Every claim displayed to a user links back to evidence: **file → page → bounding box/table row → field**.

---

## 2) North-star user experience

### A) Peer proof → credible recommendations
A user clicks a supplier and sees:
- clear benchmark narrative: **Supplier X underperforms Peer Y**,
- actionable technical steps,
- feasibility timeline,
- **evidence excerpts with page numbers**,
- contract clause + copy,
- export pack.

### B) Supplier evidence → verified impact (MRV)
The user uploads supplier evidence packs (invoices, EPDs, logistics statements, energy bills). The system:
- extracts structured tables/fields,
- normalizes units,
- computes emissions impact using transparent factors,
- flags anomalies,
- produces a review/approval screen,
- updates engagement status and reduction tracking.

---

## 3) System architecture (components)

### 3.1 Consultant Workspace (the app)
A guided, checklist-driven workflow with a Copilot panel and explicit review.

Modules:
- **Measure:** baseline inventory, coverage, uncertainty
- **Reduce:** prioritization table + deep dive action cards
- **Engage:** supplier workflows, evidence checklist, tasks
- **Evidence Library:** documents, extracted objects, provenance
- **Review & Approve:** human validation of extracted/mapped data
- **Anomalies:** fix queue
- **Report:** exports + assurance appendix

### 3.2 Document Processing Pipeline (new)
Triggered by uploads (peer + supplier documents):
1) **Preprocess:** split pages, rotate, cleanup
2) **OCR:** scans → text + bounding boxes
3) **Structured extraction:** text/tables → JSON schemas
4) **Evidence linking:** provenance graph from every field to doc location

### 3.3 LLM Orchestrator (GPT‑5.2 via Emergent) + tool calls
GPT‑5.2 acts as a controller:
- selects extraction templates
- calls tools
- asks user for missing fields
- maps extracted fields into platform objects
- writes narrative + negotiation language

Constraints:
- **No numeric invention.**
- Each claim must cite a provenance reference.

### 3.4 Anomaly & Quality Engine (new)
Runs after extraction and after computations:
- unit mismatches (kg vs t)
- spend/activity mismaps
- outliers vs prior year / peer ranges
- missing required fields
- suspicious spikes/drops
- duplicates

### 3.5 Batch processing + progress (new)
- multi-file batch jobs
- per-file stage status: queued → OCR → extracted → validated → mapped → done
- rerun extraction with different templates

---

## 4) Data model (Mongo collections)

> Design principle: **org_id everywhere** for true multi-tenancy. For MVP, default `org_id = user_id` to avoid UI friction.

### 4.1 Tenancy
- `orgs`: `{ org_id, name, created_at }`
- `org_members`: `{ org_id, user_id, role }`

### 4.2 Documents & provenance
- `documents`: metadata, storage path, sha256, encryption
- `document_pages`: per-page state
- `ocr_blocks`: text + bbox + confidence
- `extractions`: run state per template
- `extracted_tables`: normalized table JSON
- `field_provenance`: links any object field to evidence (doc/page/bbox/quote/table row)

### 4.3 Measure (inventory)
- `spend_records`
- `activity_records`
- `emission_factors` (versioned)
- `computed_emissions` (tool-produced)
- `inventory_snapshots`

### 4.4 Reduce (benchmarks + peer proof)
- `supplier_benchmarks`
- `peer_actions` (structured actions extracted from peer disclosures)
- `recommendation_content` (cached text + citations)

### 4.5 Engage + anomalies
- `engagements` (status, notes, history)
- `evidence_requests` (checklists, due dates)
- `anomalies` (severity, suggested fix)

### 4.6 Jobs & audit
- `batch_jobs`, `job_items`
- `audit_events`
- `pipeline_runs`

---

## 5) Tool-calling design (deterministic tools)

### 5.1 Extraction tools
- preprocess_document(doc_id)
- ocr_page(page_id)
- extract_tables(doc_id, template_id)
- extract_fields(doc_id, schema_id)

### 5.2 Mapping tools
- map_to_scope3_category(extracted)
- link_provenance(object_id, field_path, evidence_ref)

### 5.3 Compute tools
- normalize_units(record)
- compute_emissions(records, factor)

### 5.4 Quality tools
- validate_completeness(object)
- detect_anomalies(org_id, period)

### 5.5 Serving tools
- get_benchmark(supplier_id)
- get_peer_actions(peer_id)
- get_supplier_evidence_state(supplier_id)

---

## 6) UI/UX specification (detailed)

### 6.1 Reduce landing (Top Reduction Actions)
- KPI tiles: total upstream tCO₂e, coverage %, actionable suppliers, addressable reduction
- Table sorted by **Upstream Impact** desc
- Filters: category/rating/min impact + confidence/coverage filters
- Heatmap toggle (visual path)

### 6.2 Deep Dive panel (Action Card)
Sections:
1) Narrative (leader vs laggard)
2) Mini comparison (intensity)
3) Action plan (steps with tags)
4) Evidence excerpts (quote + page + open)
5) Supplier evidence checklist (request packet)
6) Anomalies & risks
7) Contract clause + copy
8) Export pack (PDF + assurance appendix)

### 6.3 Evidence Library
- upload
- per-doc status
- extracted tables/fields
- provenance viewer

### 6.4 Review & Approve
- left: extracted JSON tree
- right: evidence viewer with highlights
- approve/edit/flag anomaly

### 6.5 Engage
- supplier timeline
- tasks/owners/due dates
- checklist completion meter
- recompute after evidence

### 6.6 Anomalies queue
- list + severity
- click → suggested fix + rerun compute

### 6.7 Report
- inventory snapshot export
- recommendation pack export
- assurance appendix export (provenance + anomalies + factor versions)

---

## 7) Build plan (high-level, testable phases)

### Phase 0 — Integrate GPT‑5.2 (Emergent) with tool calling
- orchestrator scaffold
- tool-call schema
- session storage + trace logging

### Phase 1 — Agent sessions + full trace logging
- message + tool-call event logs
- reproducibility

### Phase 2 — Batch upload + background jobs + progress UI
- batch jobs
- per-file progress

### Phase 3 — OCR + structured JSON extraction (templates)
- peer actions extractor
- logistics activity extractor
- energy procurement extractor

### Phase 4 — Map extracted JSON → Scope 3 objects + provenance
- map and store
- review & approve

### Phase 5 — Anomaly engine + fix UI
- unit mismatches, outliers, missing fields, duplicates

### Phase 6 — Exports with assurance appendix
- provenance index + anomalies + methodology

---

## 8) 3rd-party integrations (required now)
- **GPT‑5.2 via Emergent** (LLM orchestration + tool calling)

> Implementation note: per platform rules, integrating GPT‑5.2 must be done via `integration_playbook_expert_v2`.
