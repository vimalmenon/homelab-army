#!/usr/bin/env bash
#===============================================================================
# ping-homelab.sh — Quick cluster connectivity check
#===============================================================================
# Wraps ansible-playbook ping.yml from the repo root.
# Usage:
#   ./tools/ping-homelab.sh
#===============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
exec ansible-playbook -i ansible/inventory/hosts.ini ansible/playbooks/ping.yml
