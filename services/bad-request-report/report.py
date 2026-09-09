#!/usr/bin/env python3
"""Bad Request Analyzer — daily Prometheus + Loki error report, delivered to Telegram.

Queries Prometheus (kube-state-metrics) and Loki for cluster health issues,
aggregates them into a Markdown report with Critical / Warning / Info sections,
and posts it to a Telegram chat via the Bot API.

Stdlib only (urllib) — no third-party deps.
"""

import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

PROM = os.environ.get("PROMETHEUS_URL", "http://prometheus-kube-prometheus-prometheus.monitoring.svc:9090")
LOKI = os.environ.get("LOKI_URL", "http://loki.loki.svc:3100")
TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TG_CHAT = os.environ.get("TELEGRAM_CHAT_ID", "")
LOOKBACK = os.environ.get("LOOKBACK", "24h")

HKT = timezone(timedelta(hours=8))


def http_get_json(url, params=None, timeout=30):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "bad-request-report"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def prom_query(q):
    """Run an instant PromQL query, return list of result objects."""
    try:
        d = http_get_json(PROM + "/api/v1/query", {"query": q})
        if d.get("status") != "success":
            return None
        return d["data"]["result"]
    except Exception:
        return None


def loki_count(query):
    """Run a LogQL count query, return total count (int) or None."""
    try:
        d = http_get_json(LOKI + "/loki/api/v1/query", {"query": query})
        if d.get("status") != "success":
            return None
        total = 0
        for r in d["data"]["result"]:
            v = r.get("value", [None, "0"])[1]
            try:
                total += int(float(v))
            except (TypeError, ValueError):
                pass
        return total
    except Exception:
        return None


def pod_label(result):
    m = result.get("metric", {})
    ns = m.get("namespace", "?")
    pod = m.get("pod", m.get("container", "?"))
    return ns, pod


# ---- Prometheus checks ----------------------------------------------------

def check_crashlooping():
    out = []
    r = prom_query('kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"} == 1')
    if r is None:
        return out, "error"
    for item in r:
        ns, pod = pod_label(item)
        out.append(f"{ns}/{pod}")
    return out, "ok"


def check_other_waiting():
    out = []
    r = prom_query('kube_pod_container_status_waiting_reason{reason=~"ImagePullBackOff|CreateContainerConfigError|ErrImagePull"} == 1')
    if r is None:
        return out, "error"
    for item in r:
        ns, pod = pod_label(item)
        reason = item.get("metric", {}).get("reason", "?")
        out.append(f"{ns}/{pod} ({reason})")
    return out, "ok"


def check_oomkilled():
    out = []
    r = prom_query('kube_pod_container_status_terminated_reason{reason="OOMKilled"} == 1')
    if r is None:
        return out, "error"
    for item in r:
        ns, pod = pod_label(item)
        out.append(f"{ns}/{pod}")
    return out, "ok"


def check_restarts():
    # Pods with elevated restarts over the lookback window
    out = []
    r = prom_query(f'increase(kube_pod_container_status_restarts_total[{LOOKBACK}]) > 3')
    if r is None:
        return out, "error"
    for item in r:
        ns, pod = pod_label(item)
        v = item.get("value", [None, "0"])[1]
        try:
            n = int(float(v))
        except (TypeError, ValueError):
            n = 0
        out.append((f"{ns}/{pod}", n))
    out.sort(key=lambda x: -x[1])
    return out, "ok"


def check_failed_pending():
    out = []
    r = prom_query('kube_pod_status_phase{phase=~"Failed|Pending"} == 1')
    if r is None:
        return out, "error"
    for item in r:
        ns, pod = pod_label(item)
        phase = item.get("metric", {}).get("phase", "?")
        out.append(f"{ns}/{pod} ({phase})")
    return out, "ok"


def check_deployments():
    out = []
    r = prom_query('kube_deployment_status_condition{condition="Available", status="false"} == 1')
    if r is None:
        return out, "error"
    for item in r:
        ns = item.get("metric", {}).get("namespace", "?")
        dep = item.get("metric", {}).get("deployment", "?")
        out.append(f"{ns}/{dep}")
    return out, "ok"


# ---- Loki checks ----------------------------------------------------------

def check_errors_per_ns():
    """Total 'error' log lines per namespace over lookback."""
    r = loki_count(f'sum by (namespace) (count_over_time({{namespace=~".+"}} |= "error" [{LOOKBACK}]))')
    return r


def check_authelia_errors():
    return loki_count(f'count_over_time({{namespace="authelia"}} |= "error" [{LOOKBACK}])')


# ---- Report assembly ------------------------------------------------------

def build_report():
    now = datetime.now(HKT).strftime("%Y-%m-%d %H:%M")
    lines = []
    lines.append(f"<b>Bad Request Report — {now} HKT</b>")
    lines.append("")

    critical = []
    warning = []
    info = []

    crash, crash_status = check_crashlooping()
    if crash_status == "ok":
        for c in crash:
            critical.append(f"🔴 CrashLoopBackOff: <code>{c}</code>")
    else:
        info.append("⚠️ Prometheus crashloop query failed (metric missing?)")

    other, other_status = check_other_waiting()
    if other_status == "ok":
        for o in other:
            critical.append(f"🔴 Pod stuck waiting: <code>{o}</code>")
    else:
        info.append("⚠️ Prometheus waiting-reason query failed")

    oom, oom_status = check_oomkilled()
    if oom_status == "ok":
        for o in oom:
            critical.append(f"🔴 OOMKilled: <code>{o}</code>")
    else:
        info.append("⚠️ Prometheus OOMKilled query failed")

    restarts, restarts_status = check_restarts()
    if restarts_status == "ok":
        for name, n in restarts:
            warning.append(f"🟡 {n} restarts / {LOOKBACK}: <code>{name}</code>")
    else:
        info.append("⚠️ Prometheus restarts query failed")

    failed, failed_status = check_failed_pending()
    if failed_status == "ok":
        for f in failed:
            warning.append(f"🟡 Failed/Pending pod: <code>{f}</code>")
    else:
        info.append("⚠️ Prometheus pod-phase query failed")

    deps, deps_status = check_deployments()
    if deps_status == "ok":
        for d in deps:
            critical.append(f"🔴 Deployment unavailable: <code>{d}</code>")
    else:
        info.append("⚠️ Prometheus deployment query failed")

    # Loki error totals
    err_total = check_errors_per_ns()
    if err_total is None:
        info.append("⚠️ Loki query failed (no results or unreachable)")
    elif err_total > 0:
        warning.append(f"🟡 {err_total} 'error' log lines cluster-wide / {LOOKBACK}")
    else:
        info.append("🟢 0 'error' log lines cluster-wide / {LOOKBACK}")

    authelia = check_authelia_errors()
    if authelia is not None:
        if authelia > 50:
            warning.append(f"🟡 Authelia: {authelia} auth errors / {LOOKBACK}")
        # else: intentionally quiet — password mistypes are normal

    # Assemble
    def emit(title, items, empty_msg="— none —"):
        lines.append(f"<b>{title}</b>")
        if items:
            for i in items:
                lines.append(i)
        else:
            lines.append(empty_msg)
        lines.append("")

    emit("🔴 Critical", critical)
    emit("🟡 Warning", warning)
    emit("🟢 Info", info)

    body = "\n".join(lines)
    if len(body) > 4000:
        body = body[:4000] + "\n… (truncated)"
    return body


def send_telegram(text):
    if not TG_TOKEN or not TG_CHAT:
        print("ERROR: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set")
        return False
    url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
    data = urllib.parse.urlencode({
        "chat_id": TG_CHAT,
        "text": text,
        "parse_mode": "HTML",
    }).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as r:
        resp = json.loads(r.read().decode())
    ok = resp.get("ok", False)
    print(f"telegram send ok={ok}")
    return ok


def main():
    report = build_report()
    print(report)
    print("=" * 60)
    ok = send_telegram(report)
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
