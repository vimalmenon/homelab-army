# 🛠️ Tools — Homelab Automation Scripts & Guides

Helper scripts and documentation for managing the homelab GitOps pipeline. These automate the repetitive parts of the "Adding a New Service" workflow defined in the root [README](../README.md).

## What's Here

| File | What It Does |
|------|-------------|
| [`add-subdomain.sh`](./add-subdomain.sh) | **One-shot subdomain deployment** — creates k8s manifests, ArgoCD Application, Cloudflare DNS record, tunnel ingress route, and homepage widget in one command |
| [`delete-subdomain.sh`](./delete-subdomain.sh) | **Reverse of add** — deletes Cloudflare DNS record, removes tunnel ingress, removes k8s manifests & ArgoCD app, removes homepage widget, commits |
| [`adding-new-subdomains.md`](./adding-new-subdomains.md) | **Complete reference guide** — documents the full manual process across all 5 layers (DNS → Tunnel → k8s → ArgoCD → Homepage), plus troubleshooting and verification steps |
| [`ping-homelab.sh`](./ping-homelab.sh) | **Cluster connectivity check** — runs `ansible-playbook playbooks/ping.yml` to ping every node and return a summary table (status, architecture, IP)

## Quick Start

### Automated (script)

```bash
# Static site from an HTML file
./tools/add-subdomain.sh --name myservice --file ./mysite/index.html \
  --homepage "My Service" --desc "Does cool things" --group "Infrastructure"

# Reverse proxy to an internal k8s service
./tools/add-subdomain.sh --name dashy --proxy http://dashy.dashy:8080
```

The script handles **~80% of the work**. After it finishes, you still need to:

1. Restart the Cloudflare tunnel — `pkill cloudflared && sleep 2 && cloudflared tunnel --config ~/.cloudflared/config.yml run &`
2. Force ArgoCD sync — `kubectl annotate application myservice -n argocd argocd.argoproj.io/refresh=hard --overwrite`
3. Restart Homepage — `kubectl rollout restart deployment homepage -n homepage`

### Delete (teardown)

```bash
# Remove a subdomain and all its resources
export CF_API_TOKEN=<your-token>
./tools/delete-subdomain.sh --name myservice
```

The script reverses every layer that `add-subdomain.sh` creates:
- Deletes the Cloudflare CNAME DNS record (via API, zone lookup)
- Removes the tunnel ingress route from `~/.cloudflared/config.yml`
- Deletes the `services/<name>/` directory (k8s manifests)
- Removes the ArgoCD Application YAML + app-of-apps registration
- Removes the Homepage widget
- Commits and pushes the cleanup

**Manual steps after the script:**
1. Restart the tunnel — `pkill cloudflared && sleep 2 && cloudflared tunnel --config ~/.cloudflared/config.yml run &`
2. Delete the ArgoCD App + namespace from the cluster — `kubectl delete application <name> -n argocd && kubectl delete namespace <name>`
3. Restart Homepage if a widget was removed — `kubectl rollout restart deployment homepage -n homepage`

### Manual (documentation)

If you prefer step-by-step control or need to troubleshoot, read [`adding-new-subdomains.md`](./adding-new-subdomains.md). It covers:

- Cloudflare DNS via the API (zone `a632b657b02c064e937b66f0c446f132`)
- Tunnel config editing in `~/.cloudflared/config.yml`
- k8s manifest patterns (static sites, reverse proxies)
- ArgoCD Application registration
- Homepage dashboard widget setup
- Common issues table (HTTP 530, 502, 1033, etc.)

## Prerequisites (for the script)

- `CF_API_TOKEN` environment variable (Cloudflare API token)
- `jq` installed — `sudo apt install jq`
- `kubectl` configured for the homelab cluster
- Git push rights to `github.com/vimalmenon/homelab-army`

## Relationship to the Main Workflow

The root [`README.md`](../README.md) **Adding a New Service** table lists 6 steps. This directory covers **Steps 1–5**:

| Step | What | Where | Coverage |
|------|------|-------|----------|
| 1 | k8s manifests | `services/<name>/` | Script creates them |
| 2 | ArgoCD app | `apps/<name>.yaml` | Script creates + registers it |
| 3 | List in App-of-Apps | `apps/kustomization.yaml` | Script adds it |
| 4 | DNS | Cloudflare | Script adds CNAME via API |
| 5 | Document | README tables | Manual — update root README |
| 6 | Push & verify | git → ArgoCD | Script commits + pushes |
