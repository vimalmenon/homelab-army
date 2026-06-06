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

## 🚀 What's Deployed

| Service            | Application            | Description                          |
|--------------------|------------------------|--------------------------------------|
| 📽️ **Slides**      | `apps/slides.yaml`     | Presentation server                  |
| 📊 **Uptime Kuma** | `apps/uptime-kuma.yaml`| Uptime monitoring dashboard          |
| 🌐 **NetAlertX**   | `apps/netalertx.yaml`  | Network device discovery & alerts    |
| 🤖 **n8n**         | `apps/n8n.yaml`        | Workflow automation                  |
| 🛡️ **Pi-hole**     | `apps/pihole.yaml`     | DNS sinkhole & ad-blocker            |
| 🔐 **Authelia**    | `apps/authelia.yaml`   | SSO & 2FA authentication             |
| 📈 **Grafana Stack** | `apps/grafana-stack.yaml` | Prometheus + Grafana monitoring   |
| 💾 **NFS Provisioner** | `apps/nfs-provisioner.yaml` | Dynamic NFS storage provisioning |
| 🌍 **MetalLB**     | `apps/metallb.yaml`    | Bare-metal load balancer             |

## 📁 Repo Structure

```
homelab-army/
├── .gitignore
├── README.md
├── bootstrap.sh              # One-shot cluster bootstrap
├── argocd/
│   ├── install.yaml          # ArgoCD installation manifest
│   └── ingress.yaml          # ArgoCD ingress config
├── apps/
│   ├── kustomization.yaml    # Kustomize listing of all apps
│   ├── root.yaml             # Root App-of-Apps
│   ├── slides.yaml
│   ├── uptime-kuma.yaml
│   ├── netalertx.yaml
│   ├── n8n.yaml
│   ├── pihole.yaml
│   ├── authelia.yaml
│   ├── grafana-stack.yaml
│   ├── nfs-provisioner.yaml
│   └── metallb.yaml
└── services/                 # Per-service Kustomize/Helm configs
    ├── slides/
    ├── uptime-kuma/
    ├── netalertx/
    ├── n8n/
    ├── pihole/
    ├── authelia/
    ├── grafana-stack/
    ├── nfs-provisioner/
    └── metallb/
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

Built with 🫘 and 🥧 on a kitchen table somewhere.
