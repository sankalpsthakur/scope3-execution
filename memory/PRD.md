# AI-Powered Recommendations Engine - PRD

## Original Problem Statement
Build an AI-Powered Recommendations Engine for Scope 3 "Reduce" Module - a platform that converts carbon data into actionable, peer-validated supplier negotiation strategies.

## Target Audience
- Procurement Officers
- Supply Chain Managers  
- CSO (Chief Sustainability Officers)

## Core Requirements (Static)
1. **Top Reduction Actions Dashboard** - Data table showing suppliers with CEE ratings, reduction potential, upstream impact
2. **AI Recommendation Engine** - Peer matching, gap analysis, evidence retrieval using Gemini 3 Flash
3. **Deep Dive Action Cards** - Slide-out modals with narratives, action plans, feasibility timelines, case studies, contract clauses
4. **Carbon Intensity Heatmap** - Visual representation of supplier emissions
5. **User Authentication** - Emergent-managed Google OAuth

## What's Been Implemented (Date: 2026-02-06)

### Backend (FastAPI)
- ✅ MongoDB integration with supplier_benchmarks and recommendation_content collections
- ✅ Emergent Google OAuth authentication flow
- ✅ Session-based auth with httpOnly cookies
- ✅ GET /api/suppliers - Supplier list sorted by upstream impact
- ✅ GET /api/suppliers/{id}/deep-dive - AI-powered recommendation generation
- ✅ POST /api/seed-data - Mock data seeding (12 suppliers)
- ✅ Gemini 3 Flash integration for AI recommendations
  - ✅ Evidence primitives: render PDF → OCR blocks → field provenance records
  - ✅ Quality primitives: deterministic anomaly scan + fix-queue statuses
  - ✅ Reporting period locks: enforce immutability on write endpoints (423 Locked)
- ✅ Report module: aggregates measure/engagements/anomalies/audit into audit-ready dashboard
- ✅ Integrations catalog: 17 connectors across ERP, P2P, Travel, Logistics, Sustainability, Supplier Portal categories with demo-sync
- ✅ Render deployment: single-service (SERVE_FRONTEND_DIR) at https://scope3-execution.onrender.com

### Frontend (React)
- ✅ Landing page with "Mission Control for Earth" aesthetic
- ✅ Google OAuth login integration
- ✅ Dashboard with sidebar navigation (Measure, Reduce, Engage modules)
- ✅ Supplier data table with sortable columns
- ✅ CEE rating badges (A-D with color coding)
- ✅ Deep Dive slide-out panel with AI recommendations
- ✅ Action plan display with numbered steps
- ✅ Contract clause with copy-to-clipboard
- ✅ Heatmap view toggle
- ✅ Dark theme with Barlow Condensed + Manrope fonts
  - ✅ Evidence module: upload PDFs, render pages, OCR, bbox overlay + provenance save
  - ✅ Quality module: anomaly queue + deep-link to Evidence for remediation
- ✅ Report page: executive summary, category breakdown, engagement progress, data quality summary, supplier inventory table, audit trail, methodology section, export buttons (CSRD E1-6, GHG Protocol, PDF)
- ✅ Integrations page: 17 connector cards with connect/disconnect/demo-sync, vendor outreach tab
- ✅ Quality page: anomaly table with filter/resolve/ignore, run scan button, severity badges
- ✅ Demo mode auto-auth: ProtectedRoute auto-authenticates via test-login (no Emergent OAuth needed locally)

### Design System
- Dark background (#0A0A0A) with green accents (#22C55E)
- Glassmorphism effects for modals
- Data-dense "trading floor" aesthetic
- Responsive layout

## Architecture
```
Frontend (React + Tailwind + Shadcn) → Backend (FastAPI) → MongoDB
    ├── Measure / Reduce / Engage            ↓
    ├── Integrations (17 connectors)    Gemini 3 Flash (AI Recommendations)
    ├── Quality (anomaly scan)               ↓
    └── Report (audit-ready)         Emergent Auth (Google OAuth)
                                             ↓
                                   Render (single-service deploy)
```

## Tech Stack
- Frontend: React 19, Tailwind CSS, Shadcn UI, Recharts
- Backend: FastAPI, Motor (async MongoDB), Pydantic
- Database: MongoDB
- AI: Gemini 3 Flash via emergentintegrations
- Auth: Emergent-managed Google OAuth

## P0/P1/P2 Features

### P0 (Implemented)
- [x] Dashboard with supplier rankings
- [x] AI recommendation generation
- [x] Contract clause generation
- [x] Copy-to-clipboard functionality
- [x] Google OAuth authentication
- [x] **NEW: PDF Export** - Download recommendations as formatted PDF
- [x] **NEW: Engagement Tracking** - Track supplier engagement status (not_started, in_progress, pending_response, completed, on_hold)
- [x] **NEW: Data Filtering** - Filter by category, CEE rating, min upstream impact, min reduction potential
- [x] **NEW: Evidence Library (MVP)** - Upload PDFs, render pages, OCR blocks, bbox overlay, store field-level provenance
- [x] **NEW: Quality (MVP)** - Deterministic anomaly scan + fix-queue workflow
- [x] **NEW: Reporting Period Locks (MVP)** - Lock a period to prevent mutation (423 Locked)
- [x] **NEW: Report Dashboard** - Audit-ready Scope 3 report aggregating all modules
- [x] **NEW: Integrations Catalog** - 17 connector cards for ERP/P2P/Travel/Logistics/Sustainability
- [x] **NEW: Render Deployment** - Single-service deploy with SERVE_FRONTEND_DIR

### P1 (Backlog)
- [ ] Team collaboration + RBAC (preparer/reviewer/auditor roles)
- [ ] Period-close workflow (signoff, approvals, locked reports)
- [ ] Email notifications for high-impact opportunities
- [ ] Multi-project support
- [ ] Evidence review UX (approve/edit/flag) linked directly from Measure/Reduce KPIs
- [ ] Structured extraction templates for logistics/energy/procurement docs (beyond OCR blocks)

### P2 (Future)
- [ ] Real-time CDP/GRI data ingestion
- [ ] Custom peer selection
- [ ] Benchmarking against industry averages
- [ ] Integration with procurement systems
- [ ] Carbon reduction progress tracking

## Next Tasks
1. ~~Add PDF export for recommendations~~ ✅ DONE
2. ~~Implement supplier engagement status tracking~~ ✅ DONE  
3. ~~Add data filtering (by category, rating, impact threshold)~~ ✅ DONE
4. Connect provenance requirements to KPIs (Measure/Reduce) and block report export if missing
5. Add structured extraction templates + deterministic validators (units, numeric ranges, reconciliation)
6. Add org/team model + roles + period close workflow
7. ~~Add deployment artifacts + CI workflow~~ ✅ DONE (Render single-service)
