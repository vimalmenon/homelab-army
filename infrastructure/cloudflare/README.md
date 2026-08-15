# Cloudflare Tunnel

The cloudflared tunnel is **not deployed as a Kubernetes resource**. It runs as a
user-level process on the control-plane node (`homelab01`), started by the `hermes`
user via a shell login.

**Runtime:** `cloudflared tunnel --config /home/hermes/.cloudflared/config.yml run`

**Files in this directory:**
- `config.yml` — the cloudflared ingress configuration (routes hostnames to the
  MetalLB load balancer IP `192.168.10.200`)
- `clusterrole.yaml` — the `cloudflared` ClusterRole (exists in the cluster but
  is unused — likely a leftover from a previous k8s-based deployment attempt)
- `clusterrolebinding.yaml` — the corresponding ClusterRoleBinding

**Credentials file (NOT committed):**
`/home/hermes/.cloudflared/011a9625-236e-42dc-b716-e5de75390eaa.json`
