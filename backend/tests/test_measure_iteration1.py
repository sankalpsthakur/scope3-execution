#!/usr/bin/env python3
"""Measure Module API smoke/regression tests.

Notes:
- Requires TEST_SESSION_TOKEN to call authenticated endpoints.
- Uses the same base URL as the frontend env var REACT_APP_BACKEND_URL.

Run:
  export REACT_APP_BACKEND_URL=...  # same as frontend
  export TEST_SESSION_TOKEN=...
  python /app/backend/tests/test_measure_iteration1.py
"""

import os
import sys
import json
import requests


def main() -> int:
    base_url = os.environ.get("REACT_APP_BACKEND_URL")
    token = os.environ.get("TEST_SESSION_TOKEN")

    if not base_url:
        print("Missing REACT_APP_BACKEND_URL")
        return 2
    if not token:
        print("Missing TEST_SESSION_TOKEN")
        return 2

    api = f"{base_url}/api"
    headers = {"Authorization": f"Bearer {token}"}

    def ok(name: str):
        print(f"✅ {name}")

    def fail(name: str, detail: str):
        print(f"❌ {name}: {detail}")
        raise AssertionError(detail)

    # health
    r = requests.get(f"{api}/health", timeout=15)
    if r.status_code != 200:
        fail("health", f"{r.status_code} {r.text}")
    ok("health")

    # seed
    r = requests.post(f"{api}/measure/seed", headers=headers, timeout=30)
    if r.status_code != 200:
        fail("measure seed", f"{r.status_code} {r.text}")
    ok("measure seed")

    # overview
    r = requests.get(f"{api}/measure/overview", headers=headers, params={"period": "last_12_months"}, timeout=30)
    if r.status_code != 200:
        fail("measure overview", f"{r.status_code} {r.text}")
    data = r.json()

    if data.get("total_upstream_tco2e", 0) <= 0:
        fail("measure overview", "total_upstream_tco2e <= 0")
    if not data.get("category_breakdown"):
        fail("measure overview", "missing category_breakdown")
    if not data.get("top_suppliers"):
        fail("measure overview", "missing top_suppliers")
    ok("measure overview")

    # suppliers
    r = requests.get(f"{api}/measure/suppliers", headers=headers, params={"period": "fy2024"}, timeout=30)
    if r.status_code != 200:
        fail("measure suppliers", f"{r.status_code} {r.text}")
    data2 = r.json()
    if not data2.get("top_suppliers"):
        fail("measure suppliers", "missing top_suppliers")
    ok("measure suppliers")

    print("\nAll Measure tests passed.")
    print(json.dumps({"overview": {"total_upstream_tco2e": data.get("total_upstream_tco2e"), "coverage_pct": data.get("coverage_pct")}}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
