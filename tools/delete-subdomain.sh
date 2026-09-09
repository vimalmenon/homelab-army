#!/usr/bin/env bash
#===============================================================================
# delete-subdomain.sh — Remove a subdomain from completeautomate.com homelab
#===============================================================================
set -euo pipefail
IFS=$'\n\t'

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="completeautomate.com"
SERVICE_DIR="$REPO_DIR/services"
APPS_DIR="$REPO_DIR/apps"
CFG="$HOME/.cloudflared/config.yml"
HP_CM="$SERVICE_DIR/homepage/configmap.yaml"

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[1;34m'; N='\033[0m'
info()  { echo -e " ${G}\u2713${N} $1"; }
warn()  { echo -e " ${Y}\u26a0${N} $1"; }
err()   { echo -e " ${R}\u2717${N} $1"; }
step()  { echo -e "\n${B}\u2501\u2501 $1${N}"; }

usage() {
  cat <<'EOF'
Usage: delete-subdomain.sh --name NAME

Required:
  --name NAME      Subdomain name to delete (e.g. 'myservice')

Environment:
  CF_API_TOKEN     Cloudflare API token (required for DNS deletion)

Options:
  --help           Show this help
EOF
  exit 1
}

NAME=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)     shift; NAME="$1" ;;
    --help|-h)  usage ;;
    *)          err "Unknown: $1"; usage ;;
  esac; shift
done

[[ -z "$NAME" ]] && { err "--name required"; usage; }

HOSTNAME="$NAME.$DOMAIN"
TARGET="$SERVICE_DIR/$NAME"

echo -e "\n${B}══════════════ Removing $HOSTNAME ══════════════${N}"

# ── 1. Cloudflare DNS ───────────────────────────────────────────────────────
step "Deleting Cloudflare DNS record"

if ! command -v jq &>/dev/null; then err "jq required (apt install jq)"; exit 1; fi

if [ -n "${CF_API_TOKEN:-}" ]; then
  curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" > /tmp/_cf_zone.json
  ZONE_ID=$(jq -r '.result[0].id' /tmp/_cf_zone.json)
  if [[ "$ZONE_ID" == "null" || -z "$ZONE_ID" ]]; then
    err "Failed to get zone ID"; exit 1
  fi

  curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=CNAME&name=$HOSTNAME" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" > /tmp/_cf_record.json
  RECORD_ID=$(jq -r '.result[0].id // empty' /tmp/_cf_record.json)

  if [[ -n "$RECORD_ID" ]]; then
    curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
      -H "Authorization: Bearer $CF_API_TOKEN" \
      -H "Content-Type: application/json" > /tmp/_cf_delete.json

    jq -e '.success == true' /tmp/_cf_delete.json >/dev/null 2>&1 \
      && info "DNS CNAME $HOSTNAME deleted (ID: $RECORD_ID)" \
      || err "DNS delete failed ($(jq -r '.errors[0].message' /tmp/_cf_delete.json))"
  else
    info "No DNS record found for $HOSTNAME — nothing to delete"
  fi

  rm -f /tmp/_cf_zone.json /tmp/_cf_record.json /tmp/_cf_delete.json
else
  err "CF_API_TOKEN env var not set"
  exit 1
fi

# ── 2. Tunnel ingress ───────────────────────────────────────────────────────
step "Removing tunnel ingress route"
if grep -q "hostname: $HOSTNAME" "$CFG" 2>/dev/null; then
  sed -i "/hostname: $HOSTNAME/,+1d" "$CFG"
  info "Removed from $CFG"
  warn "Restart tunnel: restart cloudflared on homelab01"
else
  info "Not found in $CFG — nothing to remove"
fi

# ── 3. k8s manifests ────────────────────────────────────────────────────────
step "Removing k8s manifests"
if [ -d "$TARGET" ]; then
  rm -rf "$TARGET"
  info "Deleted $TARGET"
else
  info "Directory $TARGET does not exist — nothing to remove"
fi

# ── 4. ArgoCD Application ───────────────────────────────────────────────────
step "Removing ArgoCD Application"
APP_FILE="$APPS_DIR/$NAME.yaml"
if [ -f "$APP_FILE" ]; then
  rm -f "$APP_FILE"
  info "Deleted $APP_FILE"
  if grep -q "^  - $NAME.yaml" "$APPS_DIR/kustomization.yaml" 2>/dev/null; then
    sed -i "/^  - $NAME.yaml/d" "$APPS_DIR/kustomization.yaml"
    info "Removed from apps/kustomization.yaml"
  fi
else
  info "$APP_FILE does not exist — nothing to remove"
fi

# ── 5. Homepage widget ──────────────────────────────────────────────────────
step "Removing Homepage widget"
if [[ -f "$HP_CM" ]]; then
  python3 - "$NAME" "$HP_CM" <<'PYEOF'
import re, sys
name, cm = sys.argv[1], sys.argv[2]
with open(cm) as f:
    content = f.read()
pattern = re.compile(
    r'\n        - ' + re.escape(name) + r':.*?(?=\n        - |\n  [a-z]|\Z)',
    re.DOTALL
)
new_content = pattern.sub('', content)
if new_content != content:
    with open(cm, 'w') as f:
        f.write(new_content)
    print("Widget removed from Homepage")
else:
    print("Widget not found in Homepage (skipping)")
PYEOF
else
  warn "Homepage config not found at $HP_CM — skipping"
fi

# ── 6. Git commit ───────────────────────────────────────────────────────────
step "Committing to git"
cd "$REPO_DIR"
if ! git diff --staged --quiet 2>/dev/null; then
  git add -A
fi
if git diff --staged --quiet 2>/dev/null; then
  info "Nothing new to commit"
else
  git commit -m "Remove $HOSTNAME subdomain"
  git push 2>/dev/null && info "Pushed to origin/main" || warn "Push failed — check repo"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${B}══════════════════════════════════════════════${N}"
echo -e "${B}  $HOSTNAME removed!${N}"
echo -e "${B}══════════════════════════════════════════════${N}"
echo ""
echo "Manual steps:"
echo "  1. Tunnel restart:"
echo "     pkill -f 'cloudflared tunnel' && sleep 2 && /usr/local/bin/cloudflared tunnel run homelab-k8s &"
echo ""
echo "  2. Force ArgoCD sync:"
echo "     kubectl delete application $NAME -n argocd"
echo "     kubectl delete namespace $NAME"
echo ""
echo "  3. Restart Homepage (if widget was removed):"
echo "     kubectl rollout restart deployment homepage -n homepage"
echo ""
