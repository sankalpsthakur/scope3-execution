.PHONY: help ci setup backend-setup backend-test frontend-setup frontend-build

help:
	@echo "Targets:"
	@echo "  make ci              Install deps, run backend pytest, run frontend build"
	@echo "  make backend-setup   Create venv + install backend deps"
	@echo "  make backend-test    Run backend pytest"
	@echo "  make frontend-setup  Install frontend deps"
	@echo "  make frontend-build  Build frontend"

ci:
	@./scripts/ci.sh

setup: backend-setup frontend-setup

backend-setup:
	@./scripts/ci.sh backend-setup

backend-test:
	@./scripts/ci.sh backend-test

frontend-setup:
	@./scripts/ci.sh frontend-setup

frontend-build:
	@./scripts/ci.sh frontend-build

