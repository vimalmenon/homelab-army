# Adding a New Subdomain to the Complete Automate Homelab

This document describes the complete process for deploying a new public-facing
service on the homelab. Every new subdomain requires changes across 5 layers.

## Overview

```
User ──cloudflare──► Tunnel ──traefik──► k8s Service ──► Deployment
         │                                      │
         └── DNS CNAME (proxied)                └─── Homepage widget
```

## Quick Way (Automated)

```bash
# Static site:
./tools/add-subdomain.sh --name myservice --file ./myservice/index.html \
  --homepage "My Service" --desc "Does things" --group "Infrastructure"

# Reverse proxy to internal service:
./tools/add-subdomain.sh --name myservice --proxy http://svc.namespace:3000
```

The script handles **Steps 1–6** below automatically. You still need to:

1. Restart the Cloudflare tunnel
2. Force ArgoCD sync (or wait 3 min for auto-sync)
3. Restart the Homepage pod

> **Prerequisites:** `CF_API_TOKEN` env var, `jq`, `kubectl` access, git push rights.

## Manual Process

### Step 1: Cloudflare DNS

Add a CNAME record for the subdomain pointing to the tunnel.

```bash
# Get zone ID
ZONE_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones?name=completeautomate.com" \
  -H "Authorization: Bearer ***" \
  | jq -r '.result[0].id')

# Add CNAME (proxied = true, orange cloud)
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"myservice","content":"011a9625-236e-42dc-b716-e5de75390eaa.cfargotunnel.com","proxied":true,"ttl":1}'
```

**Why proxied=true?** Without the orange cloud, traffic hits the tunnel's public
IP directly, bypassing Cloudflare's edge. Proxied mode gives us DDoS protection,
SSL termination, and caching. **All tunnel DNS records MUST use proxied=true.**

**Resources:**
- Zone ID: `a632b657b02c064e937b66f0c446f132`
- Account ID: `3fffdd2b812bcd8b1ee70fb599de63b7`
- Tunnel ID: `011a9625-236e-42dc-b716-e5de75390eaa`

### Step 2: Cloudflare Tunnel

Add an ingress route to the tunnel config so Cloudflare knows where to forward
requests for this subdomain.

File: `~/.cloudflared/config.yml`

```yaml
ingress:
  - hostname: argocd.completeautomate.com
    service: http://192.168.10.200
  # ... existing routes ...
  - hostname: myservice.completeautomate.com    # ← ADD
    service: http://192.168.10.200              # ← ADD
  - service: http_status:404                      # catch-all
```

The tunnel routes **everything** through the homelab load balancer
(`192.168.10.200`), which is Traefik's MetalLB IP. After editing, **restart
the tunnel**:

```bash
pkill cloudflared && sleep 2 && cloudflared tunnel --config ~/.cloudflared/config.yml run &
```

**Why restart?** The tunnel reads config on startup only — there's no hot-reload.
The config.yml is the local config. There's also a remote config on Cloudflare's
API, but the local file takes priority when running `cloudflared tunnel run`.

### Step 3: Kubernetes Resources

Create a namespace, Deployment (or whatever you need), Service, and Ingress.

**Pattern for static sites** (nginx serving HTML):

```
services/myservice/
  configmap.yaml     # HTML content as ConfigMap
  deployment.yaml    # nginx:alpine mounts the ConfigMap
  service.yaml       # ClusterIP on port 80
  ingress.yaml       # Traefik Ingress for myservice.completeautomate.com
  kustomization.yaml # Groups them together
```

**Reference: `services/arch/`** — the architecture viewer is a clean example of
a static nginx site deployed this way.

**Key points:**
- Use `ingressClassName: traefik` (not `nginx` or `istio`)
- Ingress `host` must match the Cloudflare DNS name exactly
- `pathType: Prefix` with `path: /` for simple services
- No TLS annotation needed — Cloudflare handles SSL at the edge

### Step 4: ArgoCD

Create an `Application` manifest so GitOps manages it:

```yaml
# apps/myservice.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myservice
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/vimalmenon/homelab-army.git
    targetRevision: main
    path: services/myservice
  destination:
    server: https://kubernetes.default.svc
    namespace: myservice
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

Add it to the apps kustomization:

```yaml
# apps/kustomization.yaml
resources:
  # ...
  - myservice.yaml
```

Commit and push. ArgoCD auto-syncs within ~3 minutes, or force it:

```bash
kubectl annotate application myservice -n argocd argocd.argoproj.io/refresh=hard --overwrite
```

### Step 5: Homepage Dashboard

Add a widget to the services config:

```diff
 # services/homepage/configmap.yaml > services.yaml
     - Infrastructure:
+        - Architecture Map:
+            href: https://arch.completeautomate.com
+            description: 3D system architecture viewer
+            ping: https://arch.completeautomate.com
         - NetAlertX:
```

Commit, push, then restart the homepage pod:

```bash
kubectl rollout restart deployment homepage -n homepage
```

**Why restart?** ConfigMaps are mounted via initContainer → emptyDir. The pod
must restart to re-copy the files.

### Step 6: Verify

```bash
# Public endpoint
curl -sI https://myservice.completeautomate.com
# Expect: HTTP/2 200

# Internal cluster (from any pod)
kubectl run test-$RANDOM --image=nginx:alpine --rm -it --restart=Never -- \
  curl -sI http://myservice.myservice.svc.cluster.local

# Check ArgoCD status
kubectl get application myservice -n argocd -o json | jq '{status: .status.sync.status, health: .status.health.status}'
```

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| HTTP 530 | Tunnel not running | `ps aux \| grep cloudflared` — restart if missing |
| HTTP 1033 | Wrong tunnel UUID in DNS | Check CNAME target matches tunnel ID |
| HTTP 502/503 | Traefik can't reach service | `kubectl get pods -n myservice` — check pod is Running |
| HTTP 404 | Wrong path or no ingress | Check `host:` matches DNS name exactly |
| Widget missing | Homepage pod hasn't reloaded | `kubectl rollout restart deployment homepage -n homepage` |
| ArgoCD stuck | Old sync | `kubectl annotate application myservice -n argocd argocd.argoproj.io/refresh=hard --overwrite` |
| pkill doesn't work | Multiple processes | `pkill -9 cloudflared` then start fresh |

## References

- **Repo:** `github.com/vimalmenon/homelab-army`
- **Tunnel docs:** `~/.cloudflared/config.yml`
- **Example: arch:** `services/arch/` (static site), `apps/arch.yaml` (ArgoCD)
- **Example: slides:** `services/slides/` (PVC-backed site), `apps/slides.yaml` (ArgoCD)
- **Homepage config:** `services/homepage/configmap.yaml`
- **Automation script:** `tools/add-subdomain.sh`
