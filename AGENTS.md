# Agent Guide (repo-root)

This file is for future agents working in this repo. Follow it unless a more specific `AGENTS.md` exists deeper in the tree.

## Project Map

- `backend/server.py`: FastAPI app. Most API endpoints live on `api_router` with prefix `/api`.
- `backend/.env` (optional): loaded by `backend/server.py` for local configuration (do not commit secrets).
- `backend/requirements.txt`: Python deps (includes `black`, `isort`, `flake8`, `mypy`).
- `frontend/`: Create React App (via `craco`). App code under `frontend/src/`.
  - `frontend/src/pages/`: route-level screens (React Router).
  - `frontend/src/components/`: shared UI components.
  - `frontend/src/hooks/`, `frontend/src/lib/`: hooks and utilities.
- `scripts/ci.sh` + `Makefile`: canonical build/test harness.
- `backend/tests/pytest/`: pytest-collected tests (see `pytest.ini`).
- `test_result.md`: agent↔testing-agent protocol and state log (preserve header block).

## Coding Conventions

### Python (backend)

- Format with `black` and keep imports `isort`-sorted.
- Keep endpoints async-first and avoid blocking IO in request handlers.
- Prefer Pydantic models for request/response bodies; keep schema and docs close to the route.
- Use timezone-aware datetimes (`datetime.now(timezone.utc)`), and serialize timestamps as ISO-8601.
- Avoid side effects in “computation” helpers; keep DB/network calls isolated.

### JavaScript/React (frontend)

- Keep page-level logic in `frontend/src/pages/*` and reusable pieces in `frontend/src/components/*`.
- Prefer small, focused components; move non-UI logic into `frontend/src/lib/*` or `frontend/src/hooks/*`.
- Treat API payload shapes as contracts; keep conversions (snake_case↔camelCase) at the boundary.

## Where to Add Routes vs. Services

### Adding a new API route

- Add it to `backend/server.py` on `api_router` (prefix `/api`), grouped near related routes (auth/execution/etc).
- Use explicit, versioned paths when changing behavior or payload shape (e.g. `/api/v1/...`).

### Adding new business logic (“services”)

- Keep `backend/server.py` as thin as practical: validate input → call service → format output.
- For non-trivial features, create modules and import them from `backend/server.py`, for example:
  - `backend/services/<domain>.py` (pure-ish business logic, computations, DB helpers)
  - `backend/routes/<domain>.py` (routers/endpoints; mounted by `backend/server.py`)
  - `backend/schemas/<domain>.py` (Pydantic models shared across routes/services)

If you introduce this structure, keep imports acyclic and keep module boundaries domain-oriented.

## Deterministic Numeric Policy (important)

This app ranks/compares suppliers and generates percent/score outputs. Outputs must be deterministic across runs.

- **Money/large decimals:** represent as integer minor units (preferred) or `Decimal` (not `float`).
- **Rounding:** do not rely on Python’s `round()` for business-critical values (banker’s rounding).
  - Use `Decimal.quantize(..., rounding=ROUND_HALF_UP)` (or explicitly chosen rounding) for stored/contracted numbers.
- **Stable ordering:** whenever sorting by a computed score, include a deterministic tie-breaker
  (e.g. `(-score, supplier_id)`), and never depend on insertion order from DB results.
- **No hidden nondeterminism:** avoid time-dependent values, random UUIDs, or `secrets` in pure computations.
  - In tests, freeze time / inject clocks and use fixed IDs/seeds.
- **Units:** document whether a percent is `0..1` or `0..100` and keep it consistent across backend + frontend.
- **Guard rails:** reject/normalize `NaN`/`inf` before emitting JSON.

## Testing Harness

- Backend tests (pytest-collected): `make backend-test` or `./scripts/ci.sh backend-test`.
  - `pytest.ini` only collects tests under `backend/tests/pytest/`. Add new pytest tests there.
- Full CI (backend setup+pytest + frontend setup+build): `make ci` or `./scripts/ci.sh`.

### `test_result.md` protocol

- Do **not** edit/remove the “Testing Protocol - DO NOT EDIT” header block at the top of `test_result.md`.
- When coordinating with a testing agent, log status updates in the YAML section below the protocol block.

## Documentation Expectations

When you change behavior, update docs in the same PR:

- New/changed endpoints: add a short description plus request/response examples (and auth requirements).
- New env vars/config: document the variable name, expected format, and whether it is required.
- Secrets: keep out of git; prefer local `.env` and managed secret stores.
- Testing changes: update the relevant playbook (`auth_testing.md`, `image_testing.md`) if the workflow changes.
- For substantial features, add or expand a repo-level README section (setup, run, test).
