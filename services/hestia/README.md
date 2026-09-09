# 🏛️ Hestia — Admin Backend API

Hestia is the admin backend for the **Helios** dashboard (`admin.completeautomate.com`). It aggregates data from **Clio** (messages) and **Pythia** (lead scoring) into a single API for the admin frontend.

## Stack

- **Python 3.13** + **FastAPI**
- Runs in the `microservices` namespace on the k3s cluster
- Deployed via **ArgoCD** (GitOps) at `apps/hestia.yaml`

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | Health check (liveness + readiness) |
| `GET /leads` | Aggregated leads from Clio + Pythia |

## DNS

| Hostname | Type | Target |
|---|---|---|
| `hestia.completeautomate.com` | CNAME (proxied) | Cloudflare tunnel `011a9625-236e-42dc-b716-e5de75390eaa.cfargotunnel.com` |

The DNS record is managed **manually** (not via tunnel-sync):
1. Go to Cloudflare DNS dashboard for `completeautomate.com`
2. Add CNAME record: `hestia` → `011a9625-236e-42dc-b716-e5de75390eaa.cfargotunnel.com`
3. Ensure **Proxied** (orange cloud) is ON
4. Confirm resolution: `dig hestia.completeautomate.com @1.1.1.1` returns Cloudflare edge IPs

> **Note:** Cloudflare DNS API uses the `cfut_` JWT token from the `tunnel-sync` namespace secret. Token output is masked by the terminal — use a temp file workaround for curl calls.

## Cluster Deployment

Hestia is deployed to the `microservices` namespace via k3s + ArgoCD. The Kubernetes manifests live in `services/hestia/`:

### Files

| File | Purpose |
|---|---|
| `kustomization.yaml` | Kustomize resource listing |
| `deployment.yaml` | Pod spec — single replica, liveness/readiness probes, resource limits (100m/128Mi → 300m/256Mi) |
| `service.yaml` | ClusterIP service on port 8000 |
| `ingress.yaml` | Traefik ingress for `hestia.completeautomate.com` + `hestia.homelab.local` |
| `servicemonitor.yaml` | Prometheus ServiceMonitor for metrics scraping |

### ArgoCD App

Defined in `apps/hestia.yaml`:

```yaml
spec:
  source:
    path: services/hestia
    repoURL: https://github.com/vimalmenon/homelab-army.git
  destination:
    namespace: microservices
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

Registered in `apps/kustomization.yaml` under the `resources` list.

### Adding a New Service to the Cluster (Reference)

To add a new service like Hestia:

1. **Create k8s manifests** — deployment.yaml, service.yaml, ingress.yaml, kustomization.yaml under `services/<name>/`
2. **Register ArgoCD app** — create `apps/<name>.yaml` pointing at `services/<name>/`
3. **List in app-of-apps** — add `- <name>.yaml` to `apps/kustomization.yaml`
4. **Add DNS** — create Cloudflare CNAME pointing at the tunnel UUID
5. **Update README** — add to "What's Deployed", "Repo Structure", and "Public URLs" tables
6. **Push** — ArgoCD auto-syncs the new app, tunnel-sync updates the tunnel config

## Environment Variables

| Variable | Source | Purpose |
|---|---|---|
| `DYNAMO_SVC_URL` | Hardcoded in deployment | Internal URL for Clio (messages DB gateway) |
| `PYTHIA_SVC_URL` | Hardcoded in deployment | Internal URL for Pythia (lead scoring) |

## Monitoring

- **Health**: `/health` endpoint — liveness probe every 15s, readiness probe every 10s
- **Metrics**: Prometheus ServiceMonitor at `services/hestia/servicemonitor.yaml`
- **Logs**: Loki via Promtail (DaemonSet in the cluster)
