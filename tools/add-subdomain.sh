#!/usr/bin/env bash
#===============================================================================
# add-subdomain.sh — Deploy a new subdomain on completeautomate.com homelab
#===============================================================================
set -euo pipefail
IFS=$'\n\t'

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="completeautomate.com"
TUNNEL_ID="011a9625-236e-42dc-b716-e5de75390eaa"
TUNNEL_HOST="192.168.10.200"
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
Usage: add-subdomain.sh --name NAME (--file HTML_PATH | --proxy URL) [OPTIONS]

Required (one of):
  --file PATH      Static HTML file to serve (nginx + ConfigMap)
  --proxy URL      Internal URL to reverse-proxy (e.g. http://svc.ns:3000)

Required:
  --name NAME      Subdomain name (e.g. 'myservice' -> myservice.completeautomate.com)

Options:
  --homepage NAME  Homepage widget name (default: same as --name)
  --desc TEXT      Homepage description (default: "NAME service")
  --group GROUP    Homepage group (default: Infrastructure)
  --help           Show this help
EOF
  exit 1
}

NAME=""; FILE=""; PROXY=""; HP_NAME=""; HP_DESC=""; HP_GROUP="Infrastructure"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)     shift; NAME="$1" ;;
    --file)     shift; FILE="$1" ;;
    --proxy)    shift; PROXY="$1" ;;
    --homepage) shift; HP_NAME="$1" ;;
    --desc)     shift; HP_DESC="$1" ;;
    --group)    shift; HP_GROUP="$1" ;;
    --help|-h)  usage ;;
    *)          err "Unknown: $1"; usage ;;
  esac; shift
done

[[ -z "$NAME" ]] && { err "--name required"; usage; }
[[ -n "$FILE" && -n "$PROXY" ]] && { err "Choose --file OR --proxy"; exit 1; }
[[ -z "$FILE" && -z "$PROXY" ]] && { err "Need --file or --proxy"; usage; }
[[ -n "$FILE" && ! -f "$FILE" ]] && { err "File not found: $FILE"; exit 1; }

HOSTNAME="$NAME.$DOMAIN"
[[ -z "$HP_NAME" ]] && HP_NAME="$NAME"
[[ -z "$HP_DESC" ]] && HP_DESC="$HP_NAME service"
TARGET="$SERVICE_DIR/$NAME"

echo -e "\n${B}══════════════ Adding $HOSTNAME ══════════════${N}"

# ── 1. k8s manifests ────────────────────────────────────────────────────────
step "Creating k8s manifests"
mkdir -p "$TARGET"

if [[ -n "$FILE" ]]; then
  HTML_B64=$(base64 -w0 "$FILE")
  cat > "$TARGET/configmap.yaml" <<CMEOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: $NAME-html
  namespace: $NAME
data:
  index.html: |
CMEOF
  # Append file content with proper 4-space indent
  sed 's/^/    /' "$FILE" >> "$TARGET/configmap.yaml"
  info "configmap.yaml (HTML from $FILE)"
fi

if [[ -n "$PROXY" ]]; then
  cat > "$TARGET/nginx-config.yaml" <<NCFG
apiVersion: v1
kind: ConfigMap
metadata:
  name: $NAME-nginx
  namespace: $NAME
data:
  nginx.conf: |
    events {}
    http {
      server {
        listen 80;
        location / {
          proxy_pass $PROXY;
          proxy_set_header Host \$host;
          proxy_set_header X-Real-IP \$remote_addr;
          proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto \$scheme;
        }
      }
    }
NCFG
  info "nginx-config.yaml (proxying to $PROXY)"
fi

cat > "$TARGET/deployment.yaml" <<DEP
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $NAME
  namespace: $NAME
spec:
  replicas: 1
  selector:
    matchLabels:
      app: $NAME
  template:
    metadata:
      labels:
        app: $NAME
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 50m
            memory: 32Mi
          limits:
            cpu: 200m
            memory: 128Mi
DEP

if [[ -n "$FILE" ]]; then
  cat >> "$TARGET/deployment.yaml" <<DEOF
        volumeMounts:
        - name: html
          mountPath: /usr/share/nginx/html
          readOnly: true
      volumes:
      - name: html
        configMap:
          name: $NAME-html
          items:
          - key: index.html
            path: index.html
DEOF
else
  cat >> "$TARGET/deployment.yaml" <<DPEOF
        volumeMounts:
        - name: nginx-config
          mountPath: /etc/nginx/nginx.conf
          subPath: nginx.conf
      volumes:
      - name: nginx-config
        configMap:
          name: $NAME-nginx
DPEOF
fi
info "deployment.yaml"

cat > "$TARGET/service.yaml" <<SVCEOF
apiVersion: v1
kind: Service
metadata:
  name: $NAME
  namespace: $NAME
spec:
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: $NAME
SVCEOF
info "service.yaml"

cat > "$TARGET/ingress.yaml" <<INGEOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: $NAME
  namespace: $NAME
spec:
  ingressClassName: traefik
  rules:
  - host: $HOSTNAME
    http:
      paths:
      - backend:
          service:
            name: $NAME
            port:
              number: 80
        path: /
        pathType: Prefix
INGEOF
info "ingress.yaml"

cat > "$TARGET/kustomization.yaml" <<KSTEOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- deployment.yaml
- service.yaml
- ingress.yaml
KSTEOF
if [[ -n "$FILE" ]]; then echo "- configmap.yaml" >> "$TARGET/kustomization.yaml"; fi
if [[ -n "$PROXY" ]]; then echo "- nginx-config.yaml" >> "$TARGET/kustomization.yaml"; fi
info "kustomization.yaml"

# ── 2. ArgoCD Application ───────────────────────────────────────────────────
step "Creating ArgoCD Application"

cat > "$APPS_DIR/$NAME.yaml" <<APPEOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: $NAME
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/vimalmenon/homelab-army.git
    targetRevision: main
    path: services/$NAME
  destination:
    server: https://kubernetes.default.svc
    namespace: $NAME
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
APPEOF
info "apps/$NAME.yaml"

if ! grep -q "^  - $NAME.yaml" "$APPS_DIR/kustomization.yaml" 2>/dev/null; then
  sed -i "s/^resources:/resources:\n  - $NAME.yaml/" "$APPS_DIR/kustomization.yaml"
  info "Added to apps/kustomization.yaml"
fi

# ── 3. Cloudflare DNS ────────────────────────────────────────────────────────
step "Adding Cloudflare DNS record"

if ! command -v jq &>/dev/null; then err "jq required (apt install jq)"; exit 1; fi

TMP=$(mktemp)
echo -n "$CF_API_TOKEN" > "$TMP"
CF() {
  curl -s -H "Authorization: Bearer $(cat "$TMP")" -H "Content-Type: application/json" "$@"
}

ZONE=$(CF "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" | jq -r '.result[0].id')
if [[ "$ZONE" == "null" || -z "$ZONE" ]]; then err "Failed to get zone ID"; rm -f "$TMP"; exit 1; fi

EXISTING=$(CF "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records?type=CNAME&name=$HOSTNAME" | jq -r '.result[0].id')
if [[ "$EXISTING" != "null" && -n "$EXISTING" ]]; then
  info "DNS CNAME already exists (ID: $EXISTING)"
else
  RESP=$(CF -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" \
    -d "$(printf '{"type":"CNAME","name":"%s","content":"%s.cfargotunnel.com","proxied":true,"ttl":1}' "$NAME" "$TUNNEL_ID")")
  echo "$RESP" | jq -e '.success == true' >/dev/null 2>&1 \
    && info "DNS CNAME $HOSTNAME -> $TUNNEL_ID.cfargotunnel.com (proxied)" \
    || err "DNS failed: $(echo "$RESP" | jq -r '.errors[0].message')"
fi

rm -f "$TMP"

# ── 4. Tunnel ingress ───────────────────────────────────────────────────────
step "Adding tunnel ingress route"
if grep -q "hostname: $HOSTNAME" "$CFG" 2>/dev/null; then
  info "Already in $CFG (skipping)"
else
  LINE=$(grep -n "http_status:404" "$CFG" | cut -d: -f1)
  if [[ -n "$LINE" ]]; then
    sed -i "${LINE}i\  - hostname: $HOSTNAME\n    service: http://$TUNNEL_HOST" "$CFG"
    info "Added to $CFG"
    warn "Restart tunnel: pkill cloudflared; sleep 2; cloudflared tunnel --config $CFG run &"
  else
    err "Could not find catch-all — add manually to $CFG"
  fi
fi

# ── 5. Homepage widget ──────────────────────────────────────────────────────
step "Adding Homepage widget"
if [[ ! -f "$HP_CM" ]]; then
  warn "Homepage config not found at $HP_CM — skipping"
else
  python3 <<HEREDOC
import re, os

name = os.environ['HP_NAME']
host = os.environ['HOSTNAME']
desc = os.environ['HP_DESC']
group = os.environ['HP_GROUP']
cm = os.environ['HP_CM']

with open(cm) as f:
    content = f.read()

if name in content:
    print("  Already in Homepage (skipping)")
    exit(0)

pat = re.compile(r'^    - (\S+):$', re.MULTILINE)
groups = list(pat.finditer(content))
target_start = None
target_end = None

for i, m in enumerate(groups):
    if m.group(1) == group:
        target_start = m.start()
        target_end = groups[i+1].start() if i+1 < len(groups) else len(content)
        break

if target_start is not None:
    block = f'''
        - {name}:
            href: https://{host}
            description: {desc}
            ping: https://{host}'''
    new_content = content[:target_end] + block + content[target_end:]
    with open(cm, 'w') as f:
        f.write(new_content)
    print(f"  Widget added to {group} group")
else:
    print(f"  Group '{group}' not found — widget not added")
HEREDOC
fi

# ── 6. Git commit ───────────────────────────────────────────────────────────
step "Committing to git"
cd "$REPO_DIR"
git add "services/$NAME/" "apps/$NAME.yaml" "apps/kustomization.yaml" 2>/dev/null || true
[[ -f "$HP_CM" ]] && git add "services/homepage/configmap.yaml" 2>/dev/null || true

if git diff --staged --quiet 2>/dev/null; then
  info "Nothing new to commit"
else
  git commit -m "Add $HOSTNAME subdomain ($HP_NAME)"
  git push 2>/dev/null && info "Pushed to origin/main" || warn "Push failed — check repo"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${B}══════════════════════════════════════════════${N}"
echo -e "${B}  $HOSTNAME added!${N}"
echo -e "${B}══════════════════════════════════════════════${N}"
echo ""
echo "Manual steps:"
echo "  1. Tunnel restart:"
echo "     pkill cloudflared && sleep 2 && cloudflared tunnel --config $CFG run &"
echo ""
echo "  2. Force ArgoCD sync:"
echo "     kubectl annotate application $NAME -n argocd argocd.argoproj.io/refresh=hard --overwrite"
echo ""
echo "  3. Verify: curl -sI https://$HOSTNAME"
echo ""
echo "  4. Restart homepage (for widget):"
echo "     kubectl rollout restart deployment homepage -n homepage"
echo ""
