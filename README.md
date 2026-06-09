![Status](https://img.shields.io/badge/status-operational-brightgreen)
![K3s](https://img.shields.io/badge/k3s-v1.32-ff69b4)
![ARM](https://img.shields.io/badge/arch-ARM64-red)

# 🏠 homelab-army — GitOps for my Raspberry Pi k3s Cluster

> **"My Pis are soldiers, ArgoCD is the general, GitHub is HQ."**

homelab-army is a GitOps-powered Kubernetes cluster running on three Raspberry Pis with **k3s** and **ArgoCD**. Every manifest, every config, every deployment — it all lives here. Change the repo, and the cluster follows suit.

## 🖥️ Hardware

| Hostname     | Role          | Board          | Storage     | Notes                |
|--------------|---------------|----------------|-------------|----------------------|
| `homelab01`  | Control-plane | Pi 4 (4 GB)    | SD card     | Runs the show        |
| `homelab02`  | Worker        | Pi 4 (4 GB)    | SD card     | Flaky, but loyal     |
| `homelab03`  | Worker        | Pi 5 (8 GB)    | NVMe SSD    | The muscle           |
| `hermes`     | Helper host   | Pi 4 (4 GB)    | USB SSD     | Hermes agent + node_exporter |

## 🚀 What's Deployed

| Service                | Application                     | Description                               |
|------------------------|---------------------------------|-------------------------------------------|
| 🔐 **Vaultwarden**     | `apps/vaultwarden.yaml`         | Bitwarden-compatible password manager     |
| 🛡️ **Authelia**       | `apps/authelia.yaml`            | SSO & 2FA authentication                  |
| 📈 **Grafana Stack**   | `apps/grafana-stack.yaml`       | Prometheus + Grafana monitoring           |
| 🌍 **MetalLB**         | `apps/metallb.yaml`             | Bare-metal load balancer                  |
| 💾 **NFS Provisioner** | `apps/nfs-provisioner.yaml`     | Dynamic NFS storage provisioning          |
| 🚇 **Tunnel Sync**     | `apps/tunnel-sync.yaml`         | Auto-syncs ingresses → Cloudflare tunnel  |
| 📊 **Uptime Kuma**     | `apps/uptime-kuma.yaml`         | Uptime monitoring dashboard               |
| 🌐 **NetAlertX**       | `apps/netalertx.yaml`           | Network device discovery & alerts         |
| 🤖 **n8n**             | `apps/n8n.yaml`                 | Workflow automation                       |
| 🛡️ **Pi-hole**        | `apps/pihole.yaml`              | DNS sinkhole & ad-blocker                 |
| 📽️ **Slides**         | `apps/slides.yaml`              | Presentation server                       |
| 🏠 **Homepage**        | `apps/homepage.yaml`            | Homelab dashboard with service links      |
| 🪣 **s3-svc**          | `apps/s3-svc.yaml`              | S3 file storage microservice              |
| 📬 **email-svc**       | `apps/email-svc.yaml`           | Email sending microservice                |
| 🗄️ **dynamo-svc**     | `apps/dynamo-svc.yaml`          | DynamoDB gateway microservice             |
| 💬 **messages-svc**    | `apps/messages-svc.yaml`        | Contact form submission microservice      |
| 📝 **Loki**            | `apps/loki.yaml`                | Log aggregation                           |
| 📝 **Promtail**        | `apps/promtail.yaml`            | Log shipper (cluster-wide DaemonSet)      |
| 📝 **Loki Datasource** | `apps/loki-datasource.yaml`     | Grafana Loki data source config           |
| 📊 **Dashboards**      | `apps/dashboards.yaml`          | Custom Grafana dashboards (ConfigMaps)    |
| 🛡️ **Network Policies** | `apps/network-policies.yaml`  | Zero-trust network policies via kube-router|
| 🧱 **kube-router**     | `apps/kube-router.yaml`         | Network policy enforcement DaemonSet      |
| 🔑 **AWS Secrets**     | `apps/aws-secrets.yaml`         | External Secrets + ClusterSecretStore     |
| 🔑 **External Secrets**| `apps/external-secrets.yaml`    | ESO operator deployment                   |
| 💾 **Backup**          | `apps/homelab-backup.yaml`      | S3 backup cron job                        |
| 📡 **Hermes Monitoring** | `apps/hermes-monitoring.yaml` | Hermes Pi node_exporter scraping          |

## 📁 Repo Structure

```git
homelab-army/
├── .gitignore
├── README.md
├── bootstrap.sh              # One-shot cluster bootstrap
├── ansible/                  # Ansible playbooks (k3s install, hardening, node join)
├── argocd/
│   ├── install.yaml          # ArgoCD installation manifest
│   ├── ingress.yaml          # ArgoCD ingress config
│   └── pvc-redis.yaml        # Redis PVC for ArgoCD
├── apps/
│   ├── kustomization.yaml    # Kustomize listing of all apps
│   ├── root.yaml             # Root App-of-Apps
│   └── *.yaml                # One ArgoCD Application per service (28 total)
├── dashboards/               # Custom Grafana dashboard ConfigMaps
├── infrastructure/
│   ├── cloudflare/           # ClusterRole / Config for tunnel
│   ├── metallb/              # IP pool + L2 advertisement
│   ├── namespaces.yaml       # All cluster namespaces
│   ├── network-policies/     # Per-namespace NetworkPolicies (31 total)
│   ├── nfs-provisioner/      # NFS client provisioner deployment
│   └── storage-classes.yaml  # nfs-client + local-path storage classes
└── services/                 # Per-service Kustomize configs
    ├── authelia/             # Authelia (SSO)
    ├── aws-secrets/          # ExternalSecret + ClusterSecretStore
    ├── dynamo-svc/           # DynamoDB gateway microservice
    ├── email-svc/            # Email sending microservice
    ├── grafana-stack/        # Grafana + Prometheus via Helm
    ├── hermes-monitoring/    # Hermes Pi node_exporter + dashboard
    ├── homelab-backup/       # S3 backup CronJob + check CronJob
    ├── homepage/             # Homelab dashboard
    ├── kube-router/          # Network policy DaemonSet
    ├── loki/                 # Log aggregation
    ├── messages-svc/         # Contact form submission
    ├── n8n/                  # Workflow automation
    ├── netalertx/            # Network discovery
    ├── pihole/               # DNS sinkhole
    ├── s3-svc/               # S3 file storage
    ├── slides/               # Presentation server
    ├── tunnel-sync/          # Auto-syncs ingresses → Cloudflare tunnel
    ├── uptime-kuma/          # Uptime monitoring
    └── vaultwarden/          # Password manager
```

## ⚡ Quick Start

### Prerequisites

- A k3s cluster up and running
- `kubectl` configured to point at your cluster

### Bootstrap

```bash
git clone https://github.com/vimalmenon/homelab-army.git
cd homelab-army
chmod +x bootstrap.sh
./bootstrap.sh
```

That's it. The script will:

1. Install ArgoCD into the `argocd` namespace
2. Wait for ArgoCD to be ready
3. Apply the ingress configuration
4. Create the root Application, which syncs everything else

### First Login

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d
```

Then open `https://argocd.completeautomate.com` and log in as `admin`.

### Manual App Sync (if needed)

```bash
kubectl apply -f apps/kustomization.yaml
```

## 🪖 The Army Metaphor

This cluster runs on the philosophy of **CICD — Continuous Integration, Continuous Deployment**:

| Concept | Army Analogy |
|---------|-------------|
| Raspberry Pis | Soldiers in the field |
| k3s | Squad organization |
| ArgoCD | The General (issues orders) |
| GitHub | HQ (where orders come from) |
| Kustomize/Helm | Standard-issue equipment |
| Service manifests | Battle plans |
| Sync policy | Patrol schedule |

> "In ArgoCD we trust. The cluster follows the repo. The repo is the truth."

---

## 📋 Tasks & Roadmap

| Status | Task | Notes |
|--------|------|-------|
| ✅ | **Ansible k3s cluster setup** | Create Ansible playbooks to provision a multi-node k3s cluster from scratch (OS hardening, k3s install, join workers) — `ansible/` |
| ✅ | **Vaultwarden** | Bitwarden-compatible password manager deployed at `vault.completeautomate.com` |
| ✅ | **Homepage dashboard** | Service dashboard at `homepage.completeautomate.com` behind Authelia SSO |
| ✅ | **Uptime Kuma** | Uptime monitoring at `status.completeautomate.com` |
| ✅ | **Hermes Pi monitoring** | node_exporter scraped by Prometheus + Grafana dashboard |
| ✅ | **Homelab backup** | Hermes host backup → S3 (daily), k8s CronJob backup check (every 4h) |
| ✅ | **Tunnel Sync** | Auto-syncs k3s Ingress hostnames → Cloudflare tunnel config (every 15m) |
| ✅ | **Network Policies** | 31 zero-trust policies across 8 namespaces via kube-router |
| ✅ | **External Secrets** | AWS Secrets Manager → ESO → k8s Secrets for all sensitive data |
| ⬜ | **LLM Wiki microservice** | Plan exists, not started (COM-8) |
| ⬜ | **YouTube Helper microservice** | Plan exists, not started (COM-9) |
| ⬜ | **Messages frontend** | Send Message form on messages frontend (COM-11) |
| ⬜ | **Resource limits** | n8n and Pi-hole missing resource constraints |
| ⬜ | **PodDisruptionBudgets** | Authelia, Grafana, Traefik lack PDBs |
| ⬜ | **Hardware watchdog** | Enable on homelab02 (undervoltage flakiness)

---

## 🌐 Public URLs

| Service | URL | Auth |
|---------|-----|------|
| ArgoCD | `argocd.completeautomate.com` | Authelia SSO |
| Grafana | `grafana.completeautomate.com` | Authelia SSO |
| Homepage | `homepage.completeautomate.com` | Authelia SSO |
| Uptime Kuma | `status.completeautomate.com` | Authelia SSO |
| Pi-hole | `pihole.completeautomate.com` | Password |
| Authelia | `auth.completeautomate.com` | Direct |
| n8n | `n8n.completeautomate.com` | Basic auth |
| Slides | `slides.completeautomate.com` | Authelia SSO |
| Vaultwarden | `vault.completeautomate.com` | Authelia SSO |

## 🔑 Secrets Management

Secrets use **External Secrets Operator** backed by **AWS Secrets Manager** (`ap-southeast-1`):

| Secret | AWS Key | Used By |
|--------|---------|---------|
| AWS DynamoDB/S3 credentials | `aws-dynamo-creds` | dynamo-svc, s3-svc, backup |
| Authelia JWT secret | `micro-army/authelia-jwt` | Authelia |
| Authelia session secret | `micro-army/authelia-session` | Authelia |
| Authelia encryption key | `micro-army/authelia-encryption` | Authelia |
| Grafana admin password | `micro-army/grafana-admin` | Grafana (Helm values) |
| SMTP credentials | `email-smtp-creds` | email-svc |
| Cloudflare API token | `cloudflare-token` | tunnel-sync |
| Pi-hole password | `pihole-secret` | Pi-hole |
| n8n auth password | `n8n-secret` | n8n |

## 🔗 Related Repos

- **[micro-army](https://github.com/vimalmenon/micro-army)** — Source code & Dockerfiles for the microservices (dynamo-svc, email-svc, s3-svc, messages-svc, tunnel-sync). CI builds push to `ghcr.io/vimalmenon/micro-army/*`.

---

Built with 🫘 and 🥧 on a kitchen table somewhere.
