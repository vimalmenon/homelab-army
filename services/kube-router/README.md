# kube-router — Network Policy Controller

Deploys [kube-router](https://github.com/cloudnativelabs/kube-router) as a DaemonSet to enforce Kubernetes NetworkPolicy objects across the cluster.

## Configuration

Only the **network policy controller** is enabled — routing and service proxy are disabled:

| Flag | Value | Purpose |
|------|-------|---------|
| `--run-router` | `false` | Flannel handles pod networking |
| `--run-firewall` | `true` | Enforce NetworkPolicy rules |
| `--run-service-proxy` | `false` | k3s handles service proxy natively |

## iptables-legacy fix

The DaemonSet wraps the kube-router command with a `sh -c` script that symlinks
`/usr/sbin/iptables` → `/usr/sbin/iptables-legacy` before starting.

**Why:** The nodes run **Debian 13 (Trixie)**, where the default `iptables`
binary uses the `nf_tables` backend (`iptables v1.8.11 nf_tables`). kube-router
deletes iptables rules by position number, which doesn't work reliably with
`nf_tables` — it hits a fatal error:

```
F0615 network_policy_controller.go:459
Failed to delete incorrect rule in KUBE-ROUTER-INPUT chain due to running
[/usr/sbin/iptables -t filter -D KUBE-ROUTER-INPUT 5 --wait]: exit status 4:
iptables v1.8.11 (nf_tables): RULE_DELETE failed (No such file or directory)
```

This caused the pod to crash-loop (114+ restarts per node). Switching to
`iptables-legacy` resolves the issue completely.

**Verification:** After deploying, confirm the pod is using legacy mode:
```bash
kubectl exec -n kube-system daemonset/kube-router -- iptables --version
# Expected: iptables v1.8.11 (legacy)
```

## Initial deployment

kube-router was bootstrapped manually via kubectl apply, then imported into
ArgoCD. The manifests live here and ArgoCD manages updates.
