#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR="${VENV_DIR:-$ROOT_DIR/.venv}"

log() {
  printf '%s\n' "$*" >&2
}

venv_python() {
  if [[ -x "$VENV_DIR/bin/python" ]]; then
    printf '%s\n' "$VENV_DIR/bin/python"
    return 0
  fi
  if [[ -x "$VENV_DIR/Scripts/python.exe" ]]; then
    printf '%s\n' "$VENV_DIR/Scripts/python.exe"
    return 0
  fi
  return 1
}

backend_setup() {
  log "==> Backend: creating venv ($VENV_DIR)"
  "$PYTHON_BIN" -m venv "$VENV_DIR"

  local py
  py="$(venv_python)"

  log "==> Backend: installing deps"
  "$py" -m pip install --upgrade pip
  "$py" -m pip install -r "$BACKEND_DIR/requirements.txt"
}

backend_test() {
  local py
  py="$(venv_python)" || {
    log "Backend venv not found; running setup first."
    backend_setup
    py="$(venv_python)"
  }

  log "==> Backend: pytest"
  (cd "$ROOT_DIR" && "$py" -m pytest)
}

frontend_setup() {
  log "==> Frontend: installing deps"

  if command -v yarn >/dev/null 2>&1; then
    (
      cd "$FRONTEND_DIR"
      if [[ -f yarn.lock ]]; then
        yarn install --frozen-lockfile --non-interactive
      else
        # Avoid generating a lockfile in CI/local runs.
        yarn install --no-lockfile --non-interactive
      fi
    )
    return 0
  fi

  if command -v npm >/dev/null 2>&1; then
    (
      cd "$FRONTEND_DIR"
      npm install --no-package-lock
    )
    return 0
  fi

  log "ERROR: yarn or npm is required to install frontend deps."
  return 2
}

frontend_build() {
  log "==> Frontend: build"

  if command -v yarn >/dev/null 2>&1; then
    (cd "$FRONTEND_DIR" && yarn build)
    return 0
  fi

  if command -v npm >/dev/null 2>&1; then
    (cd "$FRONTEND_DIR" && npm run build)
    return 0
  fi

  log "ERROR: yarn or npm is required to build frontend."
  return 2
}

usage() {
  cat >&2 <<'EOF'
Usage:
  ./scripts/ci.sh                # backend setup+pytest, frontend setup+build
  ./scripts/ci.sh backend-setup
  ./scripts/ci.sh backend-test
  ./scripts/ci.sh frontend-setup
  ./scripts/ci.sh frontend-build

Env vars:
  PYTHON_BIN=python3   Which Python to use for venv creation
  VENV_DIR=.venv       Where to create the backend venv
EOF
}

cmd="${1:-ci}"
case "$cmd" in
  ci)
    backend_setup
    backend_test
    frontend_setup
    frontend_build
    ;;
  backend-setup) backend_setup ;;
  backend-test) backend_test ;;
  frontend-setup) frontend_setup ;;
  frontend-build) frontend_build ;;
  -h|--help|help) usage ;;
  *)
    log "Unknown command: $cmd"
    usage
    exit 2
    ;;
esac

