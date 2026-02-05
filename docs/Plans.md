# Scope3 Execution -- Milestones & Validation Plan

End-to-end Scope 3 carbon emissions platform (Measure, Reduce, Engage, Evidence, Quality, Integrations, Report).
Backend: FastAPI + MongoDB | Frontend: CRA + Tailwind | Deployed on Render.

Production URL: https://scope3-execution.onrender.com

---

## Completed Milestones

| # | Milestone | Status |
|------|----------------------------------|--------|
| M1 | Core Platform | Done |
| M2 | Measure + Reduce | Done |
| M3 | Engage | Done |
| M4 | Evidence & Provenance | Done |
| M5 | Quality Controls | Done |
| M6 | Integrations | Done |
| M7 | Report | Done |
| M8 | Deployment | Done |
| M9 | Demo Readiness | Done |

### M1: Core Platform
- FastAPI skeleton with health and CRUD routes.
- MongoDB integration (motor async driver).
- Auth flow (demo mode auto-auth, token middleware).
- Supplier data model (name, category, spend, scope).

### M2: Measure + Reduce
- Emission factors collection (5 seeded factors).
- Purchases and activities linked to suppliers (6 seeded purchases).
- AI reduction recommendations via Gemini.
- Supplier rankings and category heatmap on Reduce dashboard.

### M3: Engage
- Supplier engagement status lifecycle: not_started, in_progress, pending_response, completed, on_hold.
- Status tracking UI with filters and progress indicators.

### M4: Evidence & Provenance
- PDF upload, render, and OCR extraction.
- Bounding-box overlay on document pages.
- Field-level provenance linking business fields to source document locations.

### M5: Quality Controls
- Deterministic anomaly scanner with 46 checks.
- Fix-queue with resolve / ignore / open statuses.
- Quality page aggregating anomaly counts and resolution rates.

### M6: Integrations
- 17 connector cards across 6 categories (ERP, Procurement, Travel, Utilities, Cloud, Custom).
- Demo-sync action that seeds Measure data from a selected connector.

### M7: Report
- Audit-ready dashboard aggregating data from all modules.
- Export buttons: CSRD E1-6, GHG Protocol, PDF.

### M8: Deployment
- Render single-service deploy with SERVE_FRONTEND_DIR serving the built frontend.
- Auto-deploy on push to main.

### M9: Demo Readiness
- All 7 pages seeded with realistic data on first load.
- Auto-auth enabled in demo mode (no login gate).
- Emergent startup script disabled.

---

## Backlog -- P1

| # | Milestone | Status |
|------|------------------------------------------------|---------|
| M10 | Team collaboration + RBAC | Backlog |
| M11 | Period-close workflow | Backlog |
| M12 | CI/CD pipeline | Backlog |
| M13 | Evidence review UX from Measure/Reduce KPIs | Backlog |
| M14 | Structured extraction templates beyond OCR | Backlog |

- **M10**: Preparer / reviewer / auditor roles with scoped permissions.
- **M11**: Signoff, approvals, and locked reports for period-close.
- **M12**: `.github/workflows` with lint, pytest, frontend build, deploy gate.
- **M13**: Click-through from Measure and Reduce KPIs to supporting evidence docs.
- **M14**: Configurable extraction templates that map OCR blocks to structured fields.

## Backlog -- P2

- Real-time CDP / GRI data ingestion.
- Custom peer selection for benchmarking.
- Industry benchmarking dashboards.
- Carbon reduction progress tracking over time.

---

## Validation Criteria

Each milestone is validated against the checks below. All must pass before a milestone is marked Done.

### Data seeding
- 5 emission factors present in the factors collection.
- 6 purchases linked to suppliers.
- 46 anomaly checks produced by the quality scanner.
- 17 integration connector cards rendered.
- Engagement statuses cover all 5 lifecycle states.

### Page rendering
- All 7 pages (Measure, Reduce, Engage, Evidence, Quality, Integrations, Report) render without console errors.
- Landing page loads and auto-authenticates in demo mode.

### API contracts
- `GET /api/health` returns 200.
- CRUD endpoints for suppliers, purchases, factors, anomalies, engagements return 200 with expected JSON shapes.
- PDF upload endpoint accepts multipart form data and returns extracted text.

### CI gate
- `make ci` passes: pytest suite (backend) + frontend production build.
- No lint errors in backend or frontend.

---

## How to run validation locally

```bash
# Backend tests
make test-backend

# Frontend build check
make build-frontend

# Full CI (both)
make ci
```
