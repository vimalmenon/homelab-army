# Ansible — k3s Cluster Playbooks

Provision a multi-node [k3s](https://k3s.io) Kubernetes cluster on Raspberry Pi / ARM64 Debian nodes from scratch.

## Quick Start

### Prerequisites

- **Ansible 9+** installed on the control node (this machine)
- Python 3 with `pip` on the control node
- SSH key-based access to all nodes (already configured — `~/.ssh/id_ed25519`)

### 1. Install collections

```bash
cd ansible
ansible-galaxy collection install -r requirements.yml
```

### 2. Get the k3s token from the existing master

```bash
K3S_TOKEN=$(ssh homelab@192.168.128.54 sudo cat /var/lib/rancher/k3s/server/token)
```

### 3. Run the full site playbook

```bash
ansible-playbook -i inventory/hosts.ini playbooks/site.yml -e "k3s_token=$K3S_TOKEN"
```

Or run phases individually:

```bash
# Phase 1: OS hardening only
ansible-playbook -i inventory/hosts.ini playbooks/os-hardening.yml

# Phase 2: Install k3s server on master
ansible-playbook -i inventory/hosts.ini playbooks/k3s-install.yml

# Phase 3: Join workers
ansible-playbook -i inventory/hosts.ini playbooks/node-join.yml -e "k3s_token=$K3S_TOKEN"
```

## Structure

```
ansible/
├── ansible.cfg              # Ansible configuration
├── requirements.yml         # Galaxy collections
├── README.md
├── files/
│   └── k3s-kubeconfig       # Fetched kubeconfig (after install)
├── inventory/
│   ├── hosts.ini            # Node inventory
│   ├── group_vars/
│   │   └── all.yml          # Common variables
│   └── host_vars/
│       ├── homelab01.yml    # Master-specific vars
│       └── worker.yml       # Worker-specific vars
└── playbooks/
    ├── site.yml             # Master orchestrator (imports all)
    ├── os-hardening.yml     # Kernel, swap, packages, firewall
    ├── k3s-install.yml      # Install k3s server on control-plane
    └── node-join.yml        # Join worker nodes
```

## What each playbook does

### `os-hardening.yml`
- Loads kernel modules (overlay, br_netfilter)
- Applies sysctl settings (IP forwarding, bridge calls)
- Disables swap (required for k3s)
- Sets timezone (`Asia/Hong_Kong`)
- Installs packages (curl, htop, nfs-common, ufw, etc.)
- Configures UFW firewall — opens k3s-required ports only

### `k3s-install.yml`
- Creates `/etc/rancher/k3s/config.yaml`
- Runs the official k3s install script (version-pinned to `v1.35.5+k3s1`)
- Waits for node to become Ready
- Fetches the kubeconfig to `files/k3s-kubeconfig`
- Displays the join token for worker setup

### `node-join.yml`
- Creates config.yaml pointing at the master
- Runs k3s agent installer
- Verifies the node joins by checking on the master via SSH

## Nodes

| Hostname        | IP               | Role           | Architecture |
|-----------------|------------------|----------------|--------------|
| homelab01       | 192.168.128.54   | Control-plane  | aarch64      |
| homelab02       | 192.168.128.60   | Worker         | aarch64      |
| homelab03       | 192.168.128.59   | Worker         | aarch64      |

## Variables (in `group_vars/all.yml`)

| Variable | Default | Description |
|----------|---------|-------------|
| `k3s_version` | `v1.35.5+k3s1` | Pinned k3s release |
| `k3s_token` | env lookup or fallback | Cluster join token |
| `metallb_ip_range` | `192.168.128.200-220` | MetalLB IP pool |
| `timezone` | `Asia/Hong_Kong` | Node timezone |
| `extra_packages` | curl, wget, vim, ... | Apt packages |
