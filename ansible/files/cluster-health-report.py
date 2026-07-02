#!/usr/bin/env python3
"""cluster-health-report.py — k3s cluster health check with Telegram delivery.

Runs kubectl checks on the cluster and outputs a formatted report.
Can optionally send to Telegram if BOT_TOKEN and CHAT_ID are provided.

Usage:
  # Local run (requires kubectl in PATH and cluster access)
  python3 cluster-health-report.py

  # Send to Telegram
  BOT_TOKEN=xxx CHAT_ID=yyy python3 cluster-health-report.py --telegram

  # Via Ansible (copy to control-plane, then run)
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone


def run(cmd: list[str]) -> str:
    """Run a command and return stdout, or empty string on failure."""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return r.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return ""


def parse_pod_age(pod_age: str) -> int:
    """Rough parse of pod age like '5d', '12h', '30m' into hours."""
    age = pod_age.strip()
    if age.endswith("d"):
        try:
            return int(age[:-1]) * 24
        except ValueError:
            return 0
    if age.endswith("h"):
        try:
            return int(age[:-1])
        except ValueError:
            return 0
    if age.endswith("m"):
        try:
            return int(age[:-1]) // 60
        except ValueError:
            return 0
    return 0


def get_report() -> str:
    """Gather cluster data and return a Markdown-formatted report string."""
    lines: list[str] = []
    ts = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    lines.append(f"🔍 *Cluster Health Report* — {ts}")
    lines.append("")

    # ── Nodes ──
    nodes = run(["kubectl", "get", "nodes", "--no-headers"])
    node_lines = [n for n in nodes.split("\n") if n.strip()]
    ready = sum(1 for n in node_lines if " Ready " in n)
    total = len(node_lines)
    icon = "✅" if ready == total else "⚠️"
    lines.append(f"*Nodes* — {icon} {ready}/{total} Ready")
    for n in node_lines:
        parts = n.split()
        if len(parts) >= 5:
            lines.append(f"  • `{parts[0]}`  {parts[1]}  v{parts[4]}")
    lines.append("")

    # ── Pod Summary ──
    pods = run(["kubectl", "get", "pods", "--all-namespaces", "--no-headers"])
    pod_lines = [p for p in pods.split("\n") if p.strip()]

    running = sum(1 for p in pod_lines if "Running" in p)
    pending = sum(1 for p in pod_lines if "Pending" in p)
    error = sum(
        1
        for p in pod_lines
        if any(x in p for x in ["Error", "CrashLoop", "ImagePullBackOff", "CreateContainer"])
    )
    completed = sum(1 for p in pod_lines if "Completed" in p)

    status_icon = "✅" if (pending == 0 and error == 0) else "⚠️"
    lines.append(f"*Pod Summary* — {status_icon}")
    lines.append(f"  • Running:   {running}")
    lines.append(f"  • Pending:   {pending}")
    lines.append(f"  • Error:     {error}")
    lines.append(f"  • Completed: {completed}")
    lines.append(f"  • Total:     {running + pending + error + completed}")
    lines.append("")

    # ── Non-healthy pods ──
    non_healthy = [
        p
        for p in pod_lines
        if any(
            x in p
            for x in [
                "Pending",
                "Error",
                "CrashLoop",
                "ImagePullBackOff",
                "CreateContainer",
                "Init:",
                "OOMKill",
            ]
        )
    ]
    if non_healthy:
        lines.append("⚠️ *Non-Healthy Pods*")
        for p in non_healthy:
            parts = p.split()
            ns = parts[0]
            name = parts[1]
            status = parts[3]
            lines.append(f"  • `{ns}/{name}` — `{status}`")
        lines.append("")

    # ── Restarts (last 48h) ──
    # Get pods JSON for accurate restart data
    pods_json_raw = run(["kubectl", "get", "pods", "--all-namespaces", "-o", "json"])
    if pods_json_raw:
        try:
            data = json.loads(pods_json_raw)
            restarted: list[tuple[str, int]] = []
            for item in data.get("items", []):
                cs = item.get("status", {}).get("containerStatuses", [])
                total_restarts = sum(c.get("restartCount", 0) for c in cs)
                if total_restarts > 0:
                    ns = item["metadata"]["namespace"]
                    name = item["metadata"]["name"]
                    restarted.append((f"{ns}/{name}", total_restarts))
            restarted.sort(key=lambda x: x[1], reverse=True)
            if restarted:
                lines.append(f"*Pods with Restarts*")
                for r_name, r_count in restarted[:10]:
                    flag = "⚠️" if r_count > 5 else "·"
                    lines.append(f"  {flag} `{r_name}` — {r_count}x")
                lines.append("")
        except json.JSONDecodeError:
            pass

    # ── Node Resources ──
    top = run(["kubectl", "top", "nodes", "--no-headers"])
    top_lines = [t for t in top.split("\n") if t.strip()]
    if top_lines:
        lines.append("*Node Resources*")
        lines.append(f"  {'Node':<14} {'CPU':<8} {'MEM':<8}")
        for t in top_lines:
            parts = t.split()
            if len(parts) >= 4:
                lines.append(f"  `{parts[0]:<12}` {parts[1]:<8} {parts[3]:<8}")
        lines.append("")

    # ── Summary line ──
    summary_parts = []
    if pending > 0:
        summary_parts.append(f"⚠️ {pending} pending")
    if error > 0:
        summary_parts.append(f"❌ {error} errors")
    if pending == 0 and error == 0:
        summary_parts.append("✅ All clear")
    summary_parts.append(f"{ready}/{total} nodes")
    lines.append(f"*Summary:* {' · '.join(summary_parts)}")
    lines.append("")

    return "\n".join(lines)


def send_telegram(message: str, bot_token: str = "", chat_id: str = "") -> bool:
    """Send the report to a Telegram chat via Bot API."""
    token = bot_token or os.environ.get("BOT_TOKEN", "")
    chat = chat_id or os.environ.get("CHAT_ID", "")
    if not token or not chat:
        print("❌ BOT_TOKEN and CHAT_ID required for Telegram delivery", file=sys.stderr)
        return False

    import urllib.request

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps(
        {
            "chat_id": chat,
            "text": message,
            "parse_mode": "Markdown",
            "disable_web_page_preview": True,
        }
    ).encode()
    req = urllib.request.Request(
        url, data=payload, headers={"Content-Type": "application/json"}
    )
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        result = json.loads(resp.read().decode())
        if result.get("ok"):
            print("✅ Telegram delivery successful")
            return True
        print(f"❌ Telegram error: {result}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"❌ Telegram send failed: {e}", file=sys.stderr)
        return False


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="k3s cluster health report with optional Telegram delivery"
    )
    parser.add_argument(
        "--telegram",
        action="store_true",
        help="Send report to Telegram via BOT_TOKEN and CHAT_ID env vars",
    )
    parser.add_argument(
        "--bot-token",
        default="",
        help="Telegram bot token (overrides BOT_TOKEN env var)",
    )
    parser.add_argument(
        "--chat-id",
        default="",
        help="Telegram chat ID (overrides CHAT_ID env var)",
    )
    args = parser.parse_args()

    report = get_report()
    print(report)

    if args.telegram:
        send_telegram(report, args.bot_token, args.chat_id)


if __name__ == "__main__":
    main()
