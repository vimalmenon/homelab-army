# Bad Request Analyzer — Implementation Plan

> **For Hermes:** Implement task-by-task using TDD. Commit after each task.

**Goal:** Daily cron job that queries Prometheus and Loki, surfaces HTTP errors, pod failures, and auth issues as a Markdown report delivered to Telegram.

**Architecture:** Python script queries Prometheus (external URL) and Loki (via `kubectl exec` into pod), aggregates results into Critical/Warning/Info buckets. Runs as a Hermes cron job on this machine.

**Tech Stack:** Python 3 stdlib + `urllib`/`json`, Prometheus HTTP API, Loki HTTP API (via kubectl exec), `subprocess` for kubectl calls.

---

## Environment

- **Machine:** hermes Pi (this machine — can `kubectl` to cluster)
- **Prometheus:** `https://prometheus.completeautomate.com` (external, works)
- **Loki:** `kubectl exec -n loki loki-0 -- wget -qO- "http://localhost:3100/loki/api/v1/..."` (pod-local, IPv6-only)
- **Script location:** `homelab-army/scripts/bad-request-analyzer.py`
- **Report target:** Telegram via cron delivery

## Queries to Implement

### Prometheus

| # | Query | What it catches | Severity |
|---|---|---|---|
| P1 | `kube_pod_container_status_restarts_total > 5` (filter last 24h delta) | Elevated restarts | Warning |
| P2 | `kube_pod_container_status_waiting_reason` | CrashLoopBackOff, CreateContainerConfigError, ImagePullBackOff | Critical |
| P3 | `kube_pod_container_status_terminated_reason{reason="OOMKilled"}` | OOM kills in last 24h | Critical |
| P4 | `kube_pod_container_status_terminated_reason{reason="Error"}` | Error exits in last 24h | Warning |
| P5 | `kube_pod_status_phase{phase=~"Failed|Pending"}` | Stuck pods | Critical |
| P6 | `kube_deployment_status_condition{condition="Available",status="false"}` | Unavailable deployments | Critical |

### Loki

| # | Query | What it catches | Severity |
|---|---|---|---|
| L1 | `{namespace="authelia"} \|= "error"` | Auth failures | Warning |
| L2 | `{namespace=~"microservices\|n8n\|linkwarden\|semaphore"} \|= "error"` | App errors | Warning |
| L3 | `{namespace!~"kube-system\|monitoring\|loki\|cert-manager.*"} \|= "Unhealthy"` | Probe failures | Warning |

---

### Task 1: Project scaffolding

**Objective:** Create the script file with imports, constants, and main skeleton.

**Files:**
- Create: `homelab-army/scripts/bad-request-analyzer.py`

**Step 1: Write the skeleton**

```python
#!/usr/bin/env python3
"""Bad Request Analyzer — daily Prometheus + Loki error report."""

import json
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from collections import defaultdict

PROMETHEUS_URL = "https://prometheus.completeautomate.com"
REPORT_TITLE = "Bad Request Report"
NOW = datetime.now(timezone.utc)
LOOKBACK = timedelta(hours=24)

def prometheus_query(query: str) -> dict:
    """Run an instant PromQL query and return parsed JSON."""
    url = f"{PROMETHEUS_URL}/api/v1/query?query={urllib.request.quote(query)}"
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read())

def loki_query(logql: str, limit: int = 100) -> dict:
    """Run a LogQL query via kubectl exec into loki pod."""
    start_ns = int((NOW - LOOKBACK).timestamp()) * 1_000_000_000
    end_ns = int(NOW.timestamp()) * 1_000_000_000
    params = f"query={urllib.request.quote(logql)}&limit={limit}&start={start_ns}&end={end_ns}"
    url = f"http://localhost:3100/loki/api/v1/query_range?{params}"
    cmd = ["kubectl", "exec", "-n", "loki", "loki-0", "--",
           "wget", "-qO-", url]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return json.loads(result.stdout) if result.stdout else {}

def main():
    report = {
        "title": f"{REPORT_TITLE} — {NOW.strftime('%Y-%m-%d')}",
        "critical": [],
        "warning": [],
        "info": [],
    }
    
    # Tasks 2-7 will populate report sections here
    
    # Print report
    print(format_report(report))

def format_report(report: dict) -> str:
    """Format report as Markdown."""
    lines = [f"**{report['title']}**", ""]
    for section in ["critical", "warning", "info"]:
        items = report[section]
        if not items:
            continue
        emoji = {"critical": "🔴", "warning": "🟡", "info": "🟢"}[section]
        lines.append(f"{emoji} **{section.title()}**")
        for item in items:
            lines.append(f"- {item}")
        lines.append("")
    if not any(report[s] for s in ["critical", "warning", "info"]):
        lines.append("✅ No issues detected in the last 24 hours.")
    return "\n".join(lines)

if __name__ == "__main__":
    main()
```

**Step 2: Verify syntax**

Run: `python3 -c "import ast; ast.parse(open('homelab-army/scripts/bad-request-analyzer.py').read()); print('OK')"`
Expected: OK

**Step 3: Commit**

```bash
cd homelab-army
git add scripts/bad-request-analyzer.py
git commit -m "feat: scaffold bad-request-analyzer script"
```

---

### Task 2: Prometheus — pod restarts

**Objective:** Query elevated pod restarts and add to report.

**Files:**
- Modify: `homelab-army/scripts/bad-request-analyzer.py`

**Step 1: Add the query function**

Add before `main()`:

```python
def check_pod_restarts(report: dict):
    """P1: Pods with elevated restarts."""
    query = "kube_pod_container_status_restarts_total > 5"
    try:
        data = prometheus_query(query)
        results = data.get("data", {}).get("result", [])
        for r in results:
            metric = r.get("metric", {})
            ns = metric.get("namespace", "?")
            pod = metric.get("pod", "?")
            container = metric.get("container", "?")
            val = r.get("value", ["", "0"])[1]
            report["warning"].append(
                f"`{ns}/{pod}/{container}` — {val} restarts"
            )
    except Exception as e:
        report["info"].append(f"Restart check failed: {e}")
```

**Step 2: Wire into main**

In `main()`, add after report dict creation:
```python
check_pod_restarts(report)
```

**Step 3: Test manually**

Run: `python3 homelab-army/scripts/bad-request-analyzer.py`
Expected: Report output with restarts section (should find metallb, linkwarden, etc.)

**Step 4: Commit**

```bash
cd homelab-army
git add scripts/bad-request-analyzer.py
git commit -m "feat: add pod restart check to analyzer"
```

---

### Task 3: Prometheus — waiting containers (CrashLoopBackOff etc.)

**Objective:** Detect pods stuck in CrashLoopBackOff or CreateContainerConfigError.

**Files:**
- Modify: `homelab-army/scripts/bad-request-analyzer.py`

**Step 1: Add the function**

```python
def check_waiting_containers(report: dict):
    """P2: Pods stuck in CrashLoopBackOff, CreateContainerConfigError, etc."""
    query = "kube_pod_container_status_waiting_reason"
    try:
        data = prometheus_query(query)
        results = data.get("data", {}).get("result", [])
        for r in results:
            metric = r.get("metric", {})
            reason = metric.get("reason", "?")
            ns = metric.get("namespace", "?")
            pod = metric.get("pod", "?")
            container = metric.get("container", "?")
            report["critical"].append(
                f"`{ns}/{pod}` — {reason} ({container})"
            )
    except Exception as e:
        report["info"].append(f"Waiting-container check failed: {e}")
```

**Step 2: Wire into main**

Add `check_waiting_containers(report)` after the restarts call.

**Step 3: Test manually**

Run: `python3 homelab-army/scripts/bad-request-analyzer.py`
Expected: Should be empty right now (cluster is healthy), section shouldn't print.

**Step 4: Commit**

```bash
git add scripts/bad-request-analyzer.py
git commit -m "feat: add waiting-container check (CrashLoopBackOff etc.)"
```

---

### Task 4: Prometheus — OOMKilled and Error exits

**Objective:** Detect OOMKilled pods and Error-terminated containers.

**Files:**
- Modify: `homelab-army/scripts/bad-request-analyzer.py`

**Step 1: Add function**

```python
def check_terminated_containers(report: dict):
    """P3+P4: OOMKilled and Error exits."""
    for reason, severity in [("OOMKilled", "critical"), ("Error", "warning")]:
        query = f'kube_pod_container_status_terminated_reason{{reason="{reason}"}}'
        try:
            data = prometheus_query(query)
            results = data.get("data", {}).get("result", [])
            for r in results:
                metric = r.get("metric", {})
                ns = metric.get("namespace", "?")
                pod = metric.get("pod", "?")
                container = metric.get("container", "?")
                report[severity].append(
                    f"`{ns}/{pod}/{container}` — {reason}"
                )
        except Exception as e:
            report["info"].append(f"Terminated-check ({reason}) failed: {e}")
```

**Step 2: Wire into main**

Add `check_terminated_containers(report)` after waiting containers.

**Step 3: Test**

Run: `python3 homelab-army/scripts/bad-request-analyzer.py`
Expected: Empty (no OOMKilled right now).

**Step 4: Commit**

```bash
git add scripts/bad-request-analyzer.py
git commit -m "feat: add OOMKilled and Error exit detection"
```

---

### Task 5: Prometheus — failed/pending pods and unavailable deployments

**Objective:** Detect pods in Failed/Pending phase and unavailable deployments.

**Files:**
- Modify: `homelab-army/scripts/bad-request-analyzer.py`

**Step 1: Add functions**

```python
def check_pod_phase(report: dict):
    """P5: Pods in Failed or Pending phase."""
    for phase in ["Failed", "Pending"]:
        query = f'kube_pod_status_phase{{phase="{phase}"}}'
        try:
            data = prometheus_query(query)
            results = data.get("data", {}).get("result", [])
            for r in results:
                metric = r.get("metric", {})
                ns = metric.get("namespace", "?")
                pod = metric.get("pod", "?")
                report["critical"].append(
                    f"`{ns}/{pod}` — Phase: {phase}"
                )
        except Exception as e:
            report["info"].append(f"Phase check ({phase}) failed: {e}")


def check_deployment_health(report: dict):
    """P6: Deployments not available."""
    query = 'kube_deployment_status_condition{condition="Available",status="false"}'
    try:
        data = prometheus_query(query)
        results = data.get("data", {}).get("result", [])
        for r in results:
            metric = r.get("metric", {})
            ns = metric.get("namespace", "?")
            deploy = metric.get("deployment", "?")
            report["critical"].append(
                f"`{ns}/deploy/{deploy}` — Not available"
            )
    except Exception as e:
        report["info"].append(f"Deployment health check failed: {e}")
```

**Step 2: Wire into main**

Add both calls after terminated containers.

**Step 3: Test**

Run: `python3 homelab-army/scripts/bad-request-analyzer.py`
Expected: Empty sections (all healthy).

**Step 4: Commit**

```bash
git add scripts/bad-request-analyzer.py
git commit -m "feat: add pod phase and deployment health checks"
```

---

### Task 6: Loki — error log queries

**Objective:** Query Loki for error logs from Authelia, microservices, and probe failures.

**Files:**
- Modify: `homelab-army/scripts/bad-request-analyzer.py`

**Step 1: Add Loki queries**

```python
LOKI_QUERIES = [
    # (logql, label, severity)
    ('{namespace="authelia"} |= "error"', "Auth failures", "warning"),
    ('{namespace=~"microservices|n8n|linkwarden|semaphore|vaultwarden|paperless"} |= "error"', "App errors", "warning"),
    ('{namespace!~"kube-system|monitoring|loki|cert-manager.*|metallb-system"} |= "Unhealthy"', "Probe failures", "warning"),
]

def check_loki_errors(report: dict):
    """L1-L3: Query Loki for error patterns."""
    for logql, label, severity in LOKI_QUERIES:
        try:
            data = loki_query(logql, limit=50)
            results = data.get("data", {}).get("result", [])
            total = sum(len(r.get("values", [])) for r in results)
            if total > 0:
                report[severity].append(
                    f"{label}: {total} error entries (24h)"
                )
        except Exception as e:
            report["info"].append(f"Loki query ({label}) failed: {e}")
```

**Step 2: Wire into main**

Add `check_loki_errors(report)` after deployment health (last Prometheus check).

**Step 3: Test**

Run: `python3 homelab-army/scripts/bad-request-analyzer.py`
Expected: Should show auth failure counts, possibly some probe failures (linkwarden, metallb).

**Step 4: Commit**

```bash
git add scripts/bad-request-analyzer.py
git commit -m "feat: add Loki error log queries"
```

---

### Task 7: Integration test — full run

**Objective:** Run the complete script and verify output format.

**Files:**
- Modify: `homelab-army/scripts/bad-request-analyzer.py`

**Step 1: Run complete report**

Run: `python3 homelab-army/scripts/bad-request-analyzer.py`
Expected output format:

```
**Bad Request Report — 2026-07-08**

🔴 **Critical**
- (any critical items or section absent)

🟡 **Warning**
- `metallb-system/metallb-frr-k8s-8tsx7/frr` — 42 restarts
- `linkwarden/linkwarden-85c6cb58dd-8dqvg/linkwarden` — 6 restarts
- Auth failures: 5 error entries (24h)

🟢 **Info**
- (any info items or section absent)
```

**Step 2: Verify no exceptions**

Run with traceback: `python3 -u homelab-army/scripts/bad-request-analyzer.py`
Expected: Clean exit, no Python tracebacks.

**Step 3: Handle edge case — empty report**

If all sections are empty, the script should print:
```
✅ No issues detected in the last 24 hours.
```
(This is already handled in `format_report()`)

**Step 4: Commit**

```bash
git add scripts/bad-request-analyzer.py
git commit -m "test: verify full analyzer run, handle edge cases"
```

---

### Task 8: Schedule cron job

**Objective:** Create Hermes cron job to run the analyzer daily at 7 AM HKT.

**Step 1: Build the cron prompt**

The cron job runs `python3 ~/homelab-army/scripts/bad-request-analyzer.py` and delivers stdout as a Markdown report. The script already prints Markdown — no agent reasoning needed, just execute and deliver.

**Step 2: Create cron job**

Use `cronjob` tool:
- Schedule: `0 23 * * *` (23:00 UTC = 07:00 HKT next day)
- Script: `~/homelab-army/scripts/bad-request-analyzer.py`
- `no_agent: true` (script output IS the report)
- Deliver to origin

**Step 3: Test first run**

Force-run the cron job once to verify delivery.

**Step 4: Document**

No git commit needed — cron job lives in Hermes config.

---

### Task 9: Tuning pass (future)

**Objective:** Adjust thresholds and reduce noise after observing a few days of reports.

**Items to tune:**
- [ ] Restart threshold — maybe `> 5` is too low/high
- [ ] Add restart delta detection (only flag NEW restarts, not accumulated count)
- [ ] Filter out known-noisy pods (metallb-frr-k8s liveness probes are normal)
- [ ] Add per-service grouping in the report
- [ ] Add Traefik access log parsing if enabled in Loki
- [ ] Distinguish transient (1-off) vs persistent (multi-day) issues
- [ ] Add `increase()` PromQL for rate-based detection vs absolute counts
- [ ] Add node resource pressure alerts (CPU > 90%, mem > 90%, disk > 85%)

**Don't implement now** — observe real data first.

---

## Verification Checklist

- [ ] Script runs without Python errors: `python3 scripts/bad-request-analyzer.py`
- [ ] Prometheus queries return data (restarts, phases, deployments)
- [ ] Loki queries return data (errors, probe failures)  
- [ ] Report format is valid Markdown (Telegram-compatible)
- [ ] Empty cluster produces "No issues" message, not error
- [ ] Cron job delivers to Telegram at 7 AM HKT
- [ ] Commit history clean (8 commits, one per task)
- [ ] Push to GitHub: `git push`
