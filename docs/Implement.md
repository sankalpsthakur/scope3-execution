# Scope3 Execution -- Implementation Guide

> Read **Plans.md** for milestones and backlog. Read **Prompt.md** for the product spec. Read **PRODUCTION_READINESS.md** for ops gaps.
> This document tells you HOW to implement changes in the codebase.

## Current state

All 9 milestones (M1-M9) are complete. The 7 modules (Measure, Reduce, Engage, Evidence, Quality, Integrations, Report) are live and demo-ready. The backlog starts at M10.

## Repository layout

```
backend/
  server.py          # Single FastAPI app -- ALL routes live here
  requirements.txt   # Python deps
  tests/pytest/      # Backend test suite
frontend/
  src/
    App.js           # Router, AuthContext, ProtectedRoute wrapper
    pages/           # One file per module (MeasurePage.jsx, etc.)
    components/      # Shared UI (Sidebar.jsx, DeepDivePanel.jsx, etc.)
    lib/api.js       # apiUrl() helper -- never hardcode URLs
  public/
docs/                # This file, Plans.md, Prompt.md, PRODUCTION_READINESS.md
Makefile             # make ci, make backend-test, make frontend-build
scripts/ci.sh        # CI runner invoked by Makefile
```

## How to add a backend endpoint

1. Open `backend/server.py`. Find the section for the related module (routes are grouped by comments like `# ===== MEASURE =====`).
2. Define Pydantic request/response models near the route.
3. Add the route to `api_router`:
   ```python
   @api_router.post("/my-resource")
   async def create_my_resource(request: Request, body: MyModel):
       # Auth: session cookie is validated by middleware
       doc = body.model_dump()
       doc["created_at"] = datetime.now(timezone.utc).isoformat()
       result = await db.my_collection.insert_one(doc)
       # Audit trail for state changes
       await db.audit_events.insert_one({
           "event": "my_resource.created",
           "resource_id": str(result.inserted_id),
           "timestamp": datetime.now(timezone.utc).isoformat(),
       })
       return {"id": str(result.inserted_id)}
   ```
4. Respect reporting period locks for write endpoints:
   ```python
   lock = await db.reporting_period_locks.find_one({"period": period_id, "locked": True})
   if lock:
       raise HTTPException(status_code=423, detail="Reporting period is locked")
   ```
5. For seed/demo endpoints, follow the pattern: `POST /api/{module}/seed` that inserts sample documents and is idempotent (check if data already exists before inserting).

## How to add a frontend page

The frontend uses a single-page layout: `App.js` routes to `Dashboard.jsx`, which renders the active module page based on the URL path.

1. Create `frontend/src/pages/NewPage.jsx`:
   ```jsx
   import { useEffect, useState } from "react";
   import axios from "axios";
   import { apiUrl } from "@/lib/api";

   export default function NewPage() {
     const [data, setData] = useState([]);
     useEffect(() => {
       axios.get(apiUrl("/my-resource"), { withCredentials: true })
         .then(r => setData(r.data));
     }, []);
     return (
       <div className="ml-64 p-8 text-white">
         {/* ml-64 accounts for the fixed sidebar */}
       </div>
     );
   }
   ```
2. Import and render in `frontend/src/pages/Dashboard.jsx`:
   - Add the import at the top.
   - Add a case in the `activeModule` useMemo (path check) and the `content` useMemo (component render).
   - Add a navigate call in the `onNavigate` handler.
3. Add a sidebar entry in `frontend/src/components/Sidebar.jsx`:
   - Add a `<button>` in the nav section with the matching key.
   - Use a Lucide icon consistent with the existing set.
4. Style: Tailwind utilities, dark theme (`bg-[#0A0A0A]`, `text-white`, `#22C55E` for accents). Use Radix UI primitives from `@/components/ui/`.

## How to seed demo data

Each module has its own seed endpoint that is called on first load or via the UI. The pattern:

| Module | Seed endpoint | What it creates |
|--------|--------------|-----------------|
| Measure | `POST /api/seed-data` | Suppliers, purchases, emission factors |
| Reduce | `POST /api/pipeline/sources/seed` | Pipeline sources for AI recommendations |
| Quality | `POST /api/anomalies/run` | Anomalies from current measure data |
| Integrations | `POST /api/integrations/{id}/demo-sync` | measure_input_rows from connector |
| Evidence | (manual upload) | PDF documents + OCR blocks |

To reset demo state: drop the relevant MongoDB collections, then call the seed endpoints.

## Testing

```bash
make backend-test    # pytest under backend/tests/pytest/
make frontend-build  # CRA production build (catches compile errors)
make ci              # Runs both sequentially via scripts/ci.sh
```

Backend tests use pytest with an async test client. Add new test files under `backend/tests/pytest/`. The test database is isolated from the dev database.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGO_URL` | Yes | MongoDB connection string |
| `DB_NAME` | Yes | Database name |
| `TEST_MODE` | No | Set `true` to enable `/api/auth/test-login` |
| `REACT_APP_BACKEND_URL` | No | Frontend API base (defaults to same origin) |
| `GEMINI_API_KEY` | No | For AI recommendations and OCR |
| `SERVE_FRONTEND_DIR` | No | Path to built frontend for single-service deploy |
| `EMERGENT_CLIENT_ID` | No | Google OAuth via Emergent (production auth) |

## Coding conventions

- **Python**: async-first, Pydantic models for request/response, `black` + `isort` formatting.
- **React**: small single-file components, `apiUrl()` for all API calls, `withCredentials: true` on every axios call.
- **Numerics**: no floats for money or emissions totals. Use `Decimal` or integer cents. Stable sort order. No `NaN`/`Inf`.
- **Audit trail**: every state-changing endpoint writes to `audit_events`.
- **Docs**: update docs in the same PR when adding new endpoints or env vars.

## Next implementation tasks (from Plans.md backlog)

**M10 -- RBAC**: Add a `roles` collection mapping user_id to role (preparer/reviewer/auditor). Add middleware that reads the role and gates endpoints. Add a role-assignment UI in Settings.

**M11 -- Period-close**: Extend `reporting_period_locks` with a signoff workflow (preparer submits, reviewer approves). Lock blocks all write endpoints for that period.

**M12 -- CI/CD**: Add `.github/workflows/ci.yml` that runs `make ci` on every PR to main. Add a deploy step that triggers Render deploy on merge.

**M13 -- Evidence review UX**: Add approve/edit/flag buttons on Evidence page entries. Link from Measure KPIs and Reduce recommendations to supporting evidence docs.

**M14 -- Structured extraction**: Build configurable templates (logistics, energy, procurement) that map OCR bounding boxes to typed fields beyond raw text blocks.

See Plans.md for full descriptions and P2 backlog items.
