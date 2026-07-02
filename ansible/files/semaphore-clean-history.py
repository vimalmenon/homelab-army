#!/usr/bin/env python3
"""semaphore-clean-history.py — Delete all completed/failed tasks from Semaphore.

Connects to the Semaphore API and purges task history.
Skips running tasks (can't delete them).
Designed to be run from Ansible on homelab01 via the Semaphore API.

Usage:
  # Show what would be deleted (dry-run)
  python3 semaphore-clean-history.py

  # Actually delete
  python3 semaphore-clean-history.py --execute

  # Keep only the last N tasks
  python3 semaphore-clean-history.py --execute --keep 3
"""
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SEMAPHORE_BASE = os.environ.get("SEMAPHORE_URL", "http://192.168.128.200")
SEMAPHORE_HOST = os.environ.get("SEMAPHORE_HOST", "ops.completeautomate.com")
PROJECT_ID = os.environ.get("SEMAPHORE_PROJECT_ID", "1")

# Credentials from env (set in Semaphore's environment config)
ADMIN_USER = os.environ.get("SEMAPHORE_USER", "admin")
ADMIN_PASS = os.environ.get("SEMAPHORE_PASSWORD", "")


def api(path: str, method: str = "GET", data: dict | None = None,
        cookie: str = "") -> tuple[int, dict | list | str]:
    """Make a Semaphore API request."""
    url = f"{SEMAPHORE_BASE}{path}"
    headers = {"Host": SEMAPHORE_HOST, "Content-Type": "application/json"}
    if cookie:
        headers["Cookie"] = f"semaphore={cookie}"

    body = json.dumps(data).encode() if data else None
    req = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(req, timeout=15) as resp:
            raw = resp.read().decode()
            ct = resp.headers.get("Content-Type", "")
            status = resp.getcode()
            if "json" in ct and raw.strip():
                return status, json.loads(raw)
            return status, raw
    except HTTPError as e:
        return e.code, e.read().decode()
    except URLError as e:
        return 0, f"Connection error: {e.reason}"


def login() -> str:
    """Authenticate and return a session cookie."""
    payload = {"auth": ADMIN_USER, "password": ADMIN_PASS}
    status, body = api("/api/auth/login", "POST", payload)

    # Login returns 204 with Set-Cookie header
    url = f"{SEMAPHORE_BASE}/api/auth/login"
    req = Request(url, data=json.dumps(payload).encode(),
                  headers={"Host": SEMAPHORE_HOST,
                           "Content-Type": "application/json"},
                  method="POST")
    try:
        resp = urlopen(req, timeout=15)
        for h, v in resp.getheaders():
            if h.lower() == "set-cookie":
                for part in v.split(";"):
                    if part.startswith("semaphore="):
                        return part.replace("semaphore=", "").strip()
    except HTTPError as e:
        print(f"❌ Login failed: HTTP {e.code}", file=sys.stderr)
        sys.exit(1)
    except URLError as e:
        print(f"❌ Login failed: {e.reason}", file=sys.stderr)
        sys.exit(1)
    print("❌ Login failed: no cookie returned", file=sys.stderr)
    sys.exit(1)


def get_tasks(cookie: str) -> list[dict]:
    """Fetch all tasks from the project."""
    _, tasks = api(f"/api/project/{PROJECT_ID}/tasks?limit=50",
                   cookie=cookie)
    if isinstance(tasks, str):
        print(f"❌ Failed to fetch tasks: {tasks}", file=sys.stderr)
        return []
    return tasks


def main():
    dry_run = "--execute" not in sys.argv
    keep = 0
    for i, arg in enumerate(sys.argv):
        if arg == "--keep" and i + 1 < len(sys.argv):
            try:
                keep = int(sys.argv[i + 1])
            except ValueError:
                pass

    cookie = login()

    tasks = get_tasks(cookie)
    if not tasks:
        print("No tasks found.")
        return

    # Sort by ID (newest last)
    tasks.sort(key=lambda t: t["id"])

    # Keep the last N if requested
    deletable = tasks[:-keep] if keep > 0 else tasks
    # Skip running tasks
    deletable = [t for t in deletable if t["status"] != "running"]
    deletable = [t for t in deletable if t["status"] != "waiting"]

    if not deletable:
        print("Nothing to delete — all tasks are running or within keep range.")
        return

    if dry_run:
        print(f"🔍 DRY RUN — Would delete {len(deletable)} task(s):")
        for t in deletable:
            print(f"  • {t['id']}: {t['tpl_alias']} — {t['status']}")
        print(f"\nPass --execute to delete. "
              f"Use --keep N to preserve the last N tasks.")
        return

    deleted = 0
    failed = 0
    for t in deletable:
        status, _ = api(f"/api/project/{PROJECT_ID}/tasks/{t['id']}",
                        "DELETE", cookie=cookie)
        if status == 204:
            print(f"  ✅ {t['id']}: {t['tpl_alias']}")
            deleted += 1
        elif status == 400:
            print(f"  ⏭️  {t['id']}: {t['tpl_alias']} — skipped (in progress)")
            failed += 1
        else:
            print(f"  ❌ {t['id']}: HTTP {status}")
            failed += 1

    print(f"\nDone: {deleted} deleted, {failed} skipped/failed")


if __name__ == "__main__":
    main()
