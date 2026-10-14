#!/usr/bin/env python3
"""backup-health.py — backup freshness check + dead-pod cleanup.

Two jobs:
  1. Verify the newest object in S3 under BACKUP_PREFIX is not stale.
  2. Delete pods stuck in a terminal failure (Error) state in the backups
     namespace, so failures don't accumulate as clutter.

Usage:
  python3 backup-health.py              # report only
  python3 backup-health.py --cleanup    # also delete Error pods

Env overrides:
  BACKUP_BUCKET      (default: completeautomate-media)
  BACKUP_PREFIX      (default: backups/)
  MAX_AGE_HOURS      (default: 28)
  BACKUPS_NAMESPACE  (default: backups)
  AWS_REGION         (default: us-east-1)

Exit code: 0 = healthy, 1 = stale / unhealthy.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime, timezone

BUCKET = os.environ.get("BACKUP_BUCKET", "completeautomate-media")
PREFIX = os.environ.get("BACKUP_PREFIX", "backups/")
MAX_AGE = float(os.environ.get("MAX_AGE_HOURS", "28"))
NAMESPACE = os.environ.get("BACKUPS_NAMESPACE", "backups")
REGION = os.environ.get("AWS_REGION", "us-east-1")

OK = "\u2705"
BAD = "\u274c"
WARN = "\u26a0\ufe0f"


def sh(cmd):
    """Run a command -> (returncode, stdout, stderr)."""
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
    except Exception as exc:  # noqa: BLE001
        return 1, "", str(exc)


def newest_backup():
    """Newest S3 object under PREFIX -> (key, age_hours, error)."""
    try:
        import boto3  # noqa: PLC0415
    except ImportError as exc:
        return None, None, "boto3 unavailable (%s)" % exc

    try:
        s3 = boto3.client("s3", region_name=REGION)
        latest_key, latest_time = None, None
        pages = s3.get_paginator("list_objects_v2").paginate(Bucket=BUCKET, Prefix=PREFIX)
        for page in pages:
            for obj in page.get("Contents", []):
                when = obj["LastModified"].replace(tzinfo=timezone.utc)
                if latest_time is None or when > latest_time:
                    latest_time, latest_key = when, obj["Key"]
    except Exception as exc:  # noqa: BLE001
        return None, None, "S3 error: %s" % exc

    if latest_key is None:
        return None, None, "no objects under s3://%s/%s" % (BUCKET, PREFIX)

    age = (datetime.now(timezone.utc) - latest_time).total_seconds() / 3600
    return latest_key, round(age, 1), ""


def error_pods():
    """Pod names in the backups namespace that are in a terminal failure state."""
    rc, out, _ = sh([
        "kubectl", "get", "pods", "-n", NAMESPACE,
        "--field-selector=status.phase=Failed",
        "--no-headers", "-o", "custom-columns=NAME:.metadata.name",
    ])
    if rc != 0:
        return []
    return [name for name in out.splitlines() if name.strip()]


def main():
    parser = argparse.ArgumentParser(description="Backup freshness check + dead-pod cleanup")
    parser.add_argument("--cleanup", action="store_true", help="delete Error pods")
    args = parser.parse_args()

    stamp = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    lines = ["\U0001f5c4\ufe0f *Backup Health* \u2014 %s" % stamp, ""]
    healthy = True

    key, age, err = newest_backup()
    if key is None:
        healthy = False
        lines.append("%s *S3 backup* \u2014 %s" % (BAD, err))
    elif age <= MAX_AGE:
        lines.append("%s *S3 backup* fresh \u2014 `%s` (%sh old, max %gh)"
                     % (OK, key, age, MAX_AGE))
    else:
        healthy = False
        lines.append("%s *S3 backup* STALE \u2014 `%s` is %sh old (max %gh)"
                     % (BAD, key, age, MAX_AGE))

    pods = error_pods()
    if not pods:
        lines.append("%s *Failed pods* in `%s` \u2014 none" % (OK, NAMESPACE))
    else:
        lines.append("%s *Failed pods* in `%s` \u2014 %d" % (WARN, NAMESPACE, len(pods)))
        lines.extend("  \u2022 `%s`" % pod for pod in pods)
        if args.cleanup:
            rc, _, cerr = sh(["kubectl", "delete", "pod", "-n", NAMESPACE] + pods)
            lines.append("%s deleted %d pod(s)" % (OK, len(pods)) if rc == 0
                         else "%s cleanup failed: %s" % (BAD, cerr))
        else:
            lines.append("  _(re-run with --cleanup to remove)_")

    lines.append("")
    lines.append("*Summary:* %s" % ("%s healthy" % OK if healthy else "%s needs attention" % BAD))
    print("\n".join(lines))
    return 0 if healthy else 1


if __name__ == "__main__":
    sys.exit(main())
