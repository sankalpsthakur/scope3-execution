# Documentation -- Status & Decision Log

Living record of what has been built, key decisions made, and current project status for scope3-execution.

Last updated: 2026-02-06

---

## Milestone Status

| # | Milestone | Status | Date | Notes |
|---|-----------|--------|------|-------|
| M1 | Core Platform | Done | 2026-02-04 | FastAPI + MongoDB + auth |
| M2 | Measure + Reduce | Done | 2026-02-04 | 5 emission factors, 6 purchases, AI recs |
| M3 | Engage | Done | 2026-02-04 | Status workflow with 5 states |
| M4 | Evidence & Provenance | Done | 2026-02-05 | PDF → OCR → bbox → provenance chain |
| M5 | Quality Controls | Done | 2026-02-05 | 46 deterministic anomaly checks |
| M6 | Integrations | Done | 2026-02-05 | 17 connectors, demo-sync seeds Measure |
| M7 | Report | Done | 2026-02-06 | Rebuilt from placeholder → full dashboard |
| M8 | Deployment | Done | 2026-02-06 | Render single-service, auto-deploy |
| M9 | Demo Readiness | Done | 2026-02-06 | All pages seeded, auto-auth, visual tested |

All nine milestones complete as of 2026-02-06.

---

## Key Decisions

1. **Single server.py** (2026-02-04)
   Keep backend as monolith for speed. Refactor path documented in AGENTS.md.

2. **Evidence-first architecture** (2026-02-05)
   Every number must trace to doc → page → bbox → field. No unprovenanced claims.

3. **LLM-free quality checks** (2026-02-05)
   Anomaly detection is deterministic code, not LLM. Reproducible across runs.

4. **SERVE_FRONTEND_DIR** (2026-02-06)
   Single-service deploy eliminates cross-origin cookie issues. Backend serves built CRA.

5. **Demo mode auto-auth** (2026-02-06)
   ProtectedRoute calls test-login automatically. Eliminates need for Emergent OAuth locally.

6. **Mock integrations** (2026-02-05)
   All 17 connectors are demo-only. Demo-sync deterministically seeds Measure input rows.

7. **Render deployment** (2026-02-06)
   Single web service at https://scope3-execution.onrender.com. Needs real MongoDB Atlas for production.

---

## Known Gaps

- No CI/CD workflow (.github/workflows) -- only local `make ci`
- No CSRF protection for cookie-based auth
- Session cleanup (expired sessions accumulate in MongoDB)
- Rate limit index creation happens in request path, should be startup
- MONGO_URL on Render is placeholder -- needs real Atlas connection
- No operational runbooks

---

## Doc Inventory

| File | Purpose | Last Updated |
|------|---------|--------------|
| README.md | Setup, quickstart, API reference | 2026-02-06 |
| AGENTS.md | Agent/dev conventions | 2026-02-05 |
| docs/Prompt.md | Goals, spec, deliverables | 2026-02-06 |
| docs/Plans.md | Milestones + validations | 2026-02-06 |
| docs/Architecture.md | Principles + constraints | 2026-02-06 |
| docs/Implement.md | Implementation guide | 2026-02-06 |
| docs/Documentation.md | This file -- status + decisions | 2026-02-06 |
| docs/PRODUCTION_READINESS.md | Consultant checklist | 2026-02-06 |
| memory/PRD.md | Product spec snapshot | 2026-02-06 |
| auth_testing.md | Auth playbook | 2026-02-06 |
