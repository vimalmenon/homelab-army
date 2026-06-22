# kube-router on Olympus Cluster

> **Current status:** Service proxy active, firewall disabled.
> See [📋 Incident Log](#incident-log-kube-router-firewall-saga) for full backstory.

## Overview

kube-router runs as a DaemonSet in the `kube-system` namespace, auto-managed by k3s via `/var/lib/rancher/k3s/server/manifests/kube-router.yaml`. It operates in a **partial mode** alongside k3s' built-in flannel CNI.

### Current Configuration

```yaml
args:
  - --run-router=false       # flannel handles CNI
  - --run-service-proxy=true  # ClusterIP reachability
  - --run-firewall=false      # disabled (see incident log)
  - --metrics-port=0          # metrics off
```

| Setting | Value | Why |
|---------|-------|-----|
| `--run-router` | `false` | k3s uses flannel — kube-router's CNI would conflict |
| `--run-service-proxy` | `true` | Required for ClusterIP (10.43.0.1) to work |
| `--run-firewall` | `false` | Network policies defined but **not enforced** (see below) |
| `--metrics-port` | `0` | Not gathering kube-router metrics |

### What Works

- ✅ **ClusterIP reachability** — all Service ClusterIPs respond
- ✅ **NodePort services** — work normally
- ✅ **LoadBalancer (MetalLB)** — unaffected, MetalLB handles LB directly
- ✅ **All 3 nodes** — homelab01, homelab02, homelab03 Running

### What Doesn't

- ❌ **Network policy enforcement** — 39 policies defined across 9 namespaces, but kube-router does not implement them

---

## Network Policy Status

There are **39 network policies** across 9 namespaces. They are defined in [`apps/network-policies.yaml`](../../apps/network-policies.yaml) and would activate immediately if `--run-firewall` were re-enabled.

```console
$ kubectl get networkpolicies --all-namespaces | wc -l
39
```

**However**, re-enabling `--run-firewall=true` is not currently possible without manual cleanup (see incident log below).

---

## Incident Log: kube-router Firewall Saga

### Date: June 22, 2026

#### Trigger
kube-router was removed from the cluster (cause unknown). This caused:
- **ClusterIP (10.43.0.1)** unreachable
- **NFS provisioner** crash-looping (leader election depends on ClusterIP)
- **MetalLB (FRR mode)** crash-looping (same root cause)
- **39 network policies** — defined but not enforced

#### Recovery (Phase 1)
Re-added kube-router with `--run-router=false --run-service-proxy=true --run-firewall=false`. ClusterIP restored immediately. All services recovered.

#### Firewall Experiment (Phase 2)
Enabled `--run-firewall=true` — kube-router's policy controller started, detected all 39 policies, then failed on iptables sync:

```
error: ipset v7.24: The set with the given name does not exist
```

Root cause: kube-router v2.10.0 generates an ipset restore file that references sets not yet created in the same transaction. Fatal error on every sync.

#### Cleanup Attempts (Phase 3) — 8 total, 0 successful

| # | Attempt | Result |
|---|---------|--------|
| 1 | `kube-router --cleanup-config` | ❌ "Set in use by kernel component" |
| 2 | Privileged DaemonSet (all 3 nodes) | ❌ xt_set module holds reference counts |
| 3 | Kill kube-router first, then clean | ❌ iptables rules survive in legacy tables |
| 4 | Nuke all iptables rules + ipsets | ❌ iptables-nft vs legacy table mismatch |
| 5-8 | Variations of above | ❌ Kernel lock is absolute |

Key constraint: Raspberry Pi OS uses `iptables` (nf_tables backend v1.8.10), but kube-router writes to **legacy iptables** tables. This dual-table setup means flushing one doesn't flush the other. The `xt_set` kernel module pins ipsets with nonzero reference counts that no userspace command can release.

#### Resolution
Reverted to `--run-firewall=false`. Cluster stable:

```
kube-router-4jrbt   Running   0   17m
kube-router-9b29g   Running   0   17m
kube-router-qmd9n   Running   0   17m
```

#### Monitoring
A cron job checks kube-router health every 15 minutes and reports here (delivered to Telegram).

---

## Future Options for Network Policy Enforcement

| Approach | Effort | Risk | Notes |
|----------|--------|------|-------|
| **Upgrade kube-router** (v2.12+) | Low | Medium | May fix ipset restore bug; needs testing on RPi OS |
| **Cilium (policy-only mode)** | Medium | Low | More setup but well-supported; can coexist with flannel |
| **Calico policy-only** | Medium | Low | Similar to Cilium; known to work with k3s |
| **Leave as-is** | None | Low | 39 policies defined but unimplemented — acceptable for homelab |

---

## Quick Reference

```bash
# Check kube-router pods
kubectl get pods -n kube-system -l k8s-app=kube-router -o wide

# View DaemonSet config
kubectl get daemonset -n kube-system kube-router -o yaml

# View kube-router logs
kubectl logs -n kube-system -l k8s-app=kube-router

# Check ipsets (inside any kube-router pod)
kubectl exec -n kube-system kube-router-XXXXX -- ipset list -n

# Count network policies
kubectl get networkpolicies --all-namespaces --no-headers | wc -l
```
