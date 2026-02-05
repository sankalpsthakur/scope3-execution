# Scope 3 Execution Platform -- Canonical Prompt

## 1. Goals

Corporate Scope 3 emissions data is scattered across invoices, ERPs, supplier portals,
and spreadsheets. Procurement teams lack a single system that converts this raw carbon
data into auditable numbers and actionable supplier strategies.

This platform closes that gap with seven integrated modules:
**Measure -> Reduce -> Engage -> Evidence -> Quality -> Integrations -> Report**.

The core value proposition: every number shown in the Report module traces back to
a source document (Evidence), passes a deterministic quality check (Quality), and
links to an action plan (Reduce/Engage). No black-box estimates.

Target users: Procurement Officers, Supply Chain Managers, Chief Sustainability Officers.

---

## 2. Spec

### 2.1 Measure
- Emission factors, purchase records, and activity data aggregate into tCO2e by
  GHG Protocol category (Purchased Goods, Business Travel, Upstream Transport, etc.).
- Seed data: 12 suppliers across 4 categories.
- API: `GET /api/suppliers`, `POST /api/seed-data`.

### 2.2 Reduce
- AI-generated reduction recommendations per supplier via Gemini 3 Flash.
- Supplier rankings by upstream impact and CEE rating (A-D).
- Deep-dive slide-out panels: narrative, action plan steps, feasibility timeline,
  contract clauses with copy-to-clipboard.
- Carbon intensity heatmap view.
- Peer comparisons and gap analysis.
- API: `GET /api/suppliers/{id}/deep-dive`.

### 2.3 Engage
- Supplier engagement tracking with status workflow:
  `not_started -> in_progress -> pending_response -> completed | on_hold`.
- Tracks outreach history and response timelines.

### 2.4 Evidence
- PDF upload, server-side page rendering (PyMuPDF), OCR via Gemini 3 Flash.
- Frontend bbox overlay on rendered pages showing extracted text regions.
- Field-level provenance records: each extracted value links back to
  (document, page, bounding box, OCR confidence).
- This is the foundation -- every number in Measure/Report should trace to Evidence.

### 2.5 Quality
- Deterministic anomaly scan (no LLM involvement). Rules check for:
  missing fields, out-of-range values, unit mismatches, year-over-year spikes.
- Fix-queue with resolve/ignore actions and severity badges.
- Deep-links from anomaly rows back to the originating Evidence document.
- API: scan trigger + CRUD on anomaly records.

### 2.6 Integrations
- 17 connector cards across 6 categories:
  ERP, P2P, Travel, Logistics, Sustainability platforms, Supplier Portal.
- Each card supports connect / disconnect / demo-sync lifecycle.
- Vendor outreach tab for requesting new integrations.

### 2.7 Report
- Audit-ready dashboard aggregating: executive summary, category breakdown,
  engagement progress, data quality summary, supplier inventory, audit trail,
  methodology section.
- Export buttons: CSRD E1-6, GHG Protocol, PDF.
- Reporting period locks: once locked, write endpoints return 423 Locked.

---

## 3. Deliverables

### Current State (Done)
- All 7 modules implemented end-to-end (backend + frontend).
- Single FastAPI server (`backend/server.py`) with `/api` router, Motor async MongoDB.
- CRA + Craco frontend with Tailwind + Radix UI, dark theme (#0A0A0A / #22C55E).
- Google OAuth via Emergent in production; `TEST_MODE` bypass for local demo.
- Deployed on Render (single-service, `SERVE_FRONTEND_DIR`).
- Live at https://scope3-execution.onrender.com.

### Backlog (P1)
- Team collaboration + RBAC (preparer / reviewer / auditor roles).
- Period-close workflow with signoff and approvals.
- Evidence review UX (approve / edit / flag) linked from Measure/Reduce KPIs.
- Structured extraction templates beyond raw OCR blocks (logistics, energy, procurement).
- Block report export when provenance coverage is incomplete.

### Future (P2)
- Real-time CDP / GRI data ingestion.
- Custom peer group selection for benchmarking.
- Integration with live procurement systems (beyond demo-sync).
- Carbon reduction progress tracking over time.

---

## 4. Success Criteria

| Criterion | Metric |
|---|---|
| Demo-ready | All 7 pages load with seeded data, no blank states |
| Audit trail | Every Report number links to Evidence provenance |
| Quality gate | Anomaly scan runs deterministically, no false negatives on known bad data |
| Auth works | Google OAuth in prod, TEST_MODE locally, session cookies persist |
| Single deploy | One Render service serves both API and frontend |
| Export functional | CSRD, GHG Protocol, and PDF exports produce downloadable files |
| Sub-3s page loads | Dashboard and Report render within 3 seconds on seeded dataset |

---

## 5. Constraints

1. **Evidence-first architecture** -- no number enters Report without a provenance
   chain back to a source document or manual attestation.
2. **Deterministic numerics** -- all emission calculations, unit conversions, and
   anomaly detection use explicit formulas. No LLM in the math path.
3. **No LLM in Quality checks** -- anomaly rules are hand-coded thresholds and
   cross-field validations. Gemini is used only in Reduce (recommendations) and
   Evidence (OCR).
4. **Single-service deploy** -- backend serves the frontend build directory.
   No separate frontend hosting or CDN.
5. **MongoDB only** -- no relational DB. All collections in one database instance.

---

## Tech Stack Reference

| Layer | Technology |
|---|---|
| Frontend | React 19, CRA + Craco, Tailwind CSS, Radix UI, Recharts |
| Backend | FastAPI, Motor (async MongoDB), Pydantic, PyMuPDF |
| Database | MongoDB |
| AI | Gemini 3 Flash (recommendations, OCR) |
| Auth | Emergent Google OAuth / TEST_MODE |
| Deploy | Render single-service |
