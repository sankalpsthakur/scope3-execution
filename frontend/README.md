# Frontend (scope3-execution)

React UI for the Scope 3 Measure / Reduce / Engage / Report / Integrations / Evidence / Quality demo.

## Prereqs

- Node.js 18+
- `yarn` or `npm`
- `REACT_APP_BACKEND_URL` configured (see repo root `README.md`)

## Setup

```bash
cd frontend
yarn install  # or: npm install --legacy-peer-deps
```

> **Note:** `npm install` requires `--legacy-peer-deps` due to a react-day-picker peer dependency conflict with React 19.

## Run

```bash
cd frontend
yarn start  # or: npm start
```

## Build

```bash
cd frontend
yarn build  # or: npm run build
```

## Pages

| Route | Module |
|---|---|
| `/dashboard/measure` | Measure |
| `/dashboard/reduce` | Reduce |
| `/dashboard/engage` | Engage |
| `/dashboard/report` | Report |
| `/dashboard/integrations` | Integrations |
| `/dashboard/evidence` | Evidence |
| `/dashboard/quality` | Quality |

## Notes

- This is a Create React App (CRACO) project.
- The backend uses credentialed requests (cookies). For local dev, see the "Local auth note" in the root `README.md`.
- In demo mode (`TEST_MODE=true` on backend), the `ProtectedRoute` component auto-authenticates -- no manual login needed.
