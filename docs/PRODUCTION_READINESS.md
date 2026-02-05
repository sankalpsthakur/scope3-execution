# Production Readiness (Consultant Checklist)

Last reviewed: **2026-02-05**

This document is a practical, “consultant-style” checklist for taking this repo from working prototype → production-grade service. It also captures **known gaps** observed in the current codebase state on **2026-02-05**.

## Scope
- Backend: `backend/server.py` (FastAPI) + MongoDB
- Frontend: `frontend/` (React build exists)
- Auth: cookie `session_token` and `Authorization: Bearer <session_token>`
- External dependencies: Emergent auth session-data endpoint; Gemini Flash Vision for OCR

## Readiness checklist

### 1) Environments & configuration
- Define environments: `dev`, `staging`, `prod` with explicit configuration matrices (origins, DB URIs, secrets, API keys, logging).
- Ensure “safe defaults”: production must not run with `CORS_ORIGINS="*"`, `TEST_MODE=true`, or debug logging.
- Provide an `.env.example` (or equivalent) that enumerates required variables and what they do.
- Centralize config validation at startup (fail fast if critical env vars are missing).

### 2) Identity, auth, and session management
- Decide on one primary auth mechanism for production:
  - cookie sessions (needs CSRF protection), or
  - bearer tokens (needs secure storage in the client, rotation/expiry, revocation strategy).
- Enforce consistent session TTL behavior:
  - server-side validation checks expiry; also ensure expired sessions are **actually removed** from the DB (TTL index / cleanup job).
- If cookies are used cross-site (`SameSite=None`), add CSRF protections for state-changing requests.
- Document a deterministic E2E auth flow for test automation (see `auth_testing.md`).

### 3) API contracts & compatibility
- Version the API surface (even if only `/api/v1/...`) and define compatibility rules.
- Add request/response schemas for endpoints that are externally consumed; codify error shapes.
- Add limits and validation for large inputs (base64 image sizes, PDF uploads, text fields).

### 4) Data & storage (MongoDB)
- Add explicit indexes for high-traffic queries and uniqueness constraints where appropriate.
- Define retention policies:
  - sessions, audit events, OCR artifacts, uploads, derived/cached content.
- Backups:
  - restore drills, retention, encryption at rest, access controls.
- Migrations:
  - define how schema changes are applied (migrate scripts / versioned migrations).

### 5) Security fundamentals
- Secrets management: never store secrets in git; rotate on exposure; scope to least privilege.
- Transport security: enforce HTTPS end-to-end (ingress + service-to-service if applicable).
- Security headers and hardening on the frontend hosting layer (CSP, HSTS, etc.).
- Rate limiting:
  - ensure it covers both authenticated and unauthenticated attack surfaces.
  - measure/alert on 429s and suspicious patterns.
- Dependency hygiene:
  - vulnerability scanning and regular updates; lockfile strategy for frontend package manager.

### 6) Observability & operations
- Logging:
  - structured logs (request id, user/tenant id, endpoint, latency, errors).
- Metrics:
  - p50/p95 latency, error rates, rate limit denials, queue length (if any), OCR throughput.
- Tracing (optional but recommended if multiple services exist).
- Alerts:
  - error budget / SLOs, on-call rotation, incident runbooks.
- Audit trails:
  - define what events must be captured and retention requirements.

### 7) Reliability & performance
- Resource limits:
  - protect OCR endpoints and file operations from unbounded memory usage (base64 decode, PDF rendering).
- Timeouts:
  - enforce reasonable timeouts to external LLM/OAuth services; retry with jitter where safe.
- Concurrency:
  - understand uvicorn worker model and Mongo connection pool sizing.
- Startup:
  - move one-time work (index creation, heavy initialization) out of request paths.

### 8) Testing & CI/CD
- CI pipeline should run on every PR:
  - `make ci` (backend pytest + frontend build) at minimum.
- Add integration tests for:
  - auth (cookie + bearer), CORS behavior, rate limiting, key endpoints.
- Add smoke tests for staging/prod deployments.
- Release process:
  - versioning, changelog, rollback strategy, and deployment promotion steps.

## Quick repo audit (what exists today)
- A local CI script and Make targets exist: `scripts/ci.sh`, `Makefile`.
- Backend has:
  - session-cookie issuance with `Secure` + `SameSite=None` for `session_token`
  - audit event writes (`audit_events`)
  - Mongo-backed TTL-based rate limiting for `rate_limit_hits`
- Testing helpers exist:
  - `POST /api/auth/test-login` gated behind `TEST_MODE=true` and `X-Test-Auth`

## Known gaps (observed 2026-02-05)
- No checked-in CI workflow configuration (e.g., `.github/workflows/*`) despite `scripts/ci.sh` and `make ci`.
- Session storage has expiry checks in code, but there is no Mongo TTL index or cleanup routine for `user_sessions`, so expired sessions can accumulate.
- Cookie auth is configured for cross-site (`SameSite=None`, `Secure`) and CORS allows credentials; there is no explicit CSRF protection noted for state-changing endpoints.
- Rate limiting uses a Mongo TTL index on `rate_limit_hits`, but the index creation call happens in the request path (index creation should be startup-time).
- The `auth/test-login` endpoint is documented as “deterministic auth”, but it returns a newly generated session token each call; this is deterministic for identity (`test_user`) but not for token value.
- Render deployment is live (https://scope3-execution.onrender.com) with single-service architecture (`SERVE_FRONTEND_DIR`). `MONGO_URL` must be updated to a real MongoDB Atlas connection string.
- Operational runbooks are not present.

## Suggested next steps (small → impactful)
1) Add a real CI workflow that runs `make ci` on PRs.
2) Add Mongo TTL index (or scheduled cleanup) for `user_sessions` + index review for hot collections.
3) Decide on a production auth posture (cookie+CSRF or bearer-only) and document it.
4) Move request-path initialization (e.g., index creation) to app startup.
5) Update `MONGO_URL` on Render to a production MongoDB Atlas cluster and disable `TEST_MODE`.
