# Story: The Cilium Chapter

> *Replace the flannel + kube-router split stack with a single eBPF-based networking layer, bringing proper NetworkPolicy enforcement back to the Pi cluster.*

## Current State

```
┌─────────────┐  ┌──────────────────┐  ┌──────────────┐
│   Flannel    │  │  kube-router     │  │  k3s service  │
│  (routing)   │  │  (routing+proxy) │  │    proxy      │
│  k3s-builtin │  │  k3s-managed     │  │  (built-in)   │
│  VXLAN       │  │  firewall=off    │  │               │
└─────────────┘  └──────────────────┘  └──────────────┘
         ↓ Network policies NOT enforced
```

## Chapters

| # | Chapter | What | Risk |
|---|---------|------|------|
| 0 | **Last Attempt: Fix kube-router** | Nuke all iptables state on each node, clear xtables.lock, restart with `--run-firewall=true`. If it stays stable → keep. If it crashes → move to Cilium. | Low |
| 1 | **Reconnaissance** | Audit current k3s config — find cluster CIDR, flannel mode, node flags | Low |
| 2 | **Disarmament** | Remove current kube-router + disable flannel in k3s config | Medium |
| 3 | **The Cilium Installation** | Deploy Cilium via Helm with k3s flags | Low |
| 4 | **Verification** | Pod IPs, cross-node traffic, NetworkPolicies enforced | Low |
| 5 | **Worker Nodes** | Confirm all 3 nodes have healthy cilium-agent pods | Low |
| 6 | **Hubble (bonus)** | Deploy Cilium's traffic observability UI | Low |

## Rollback

If Cilium causes issues:
- `helm uninstall cilium -n kube-system`
- Remove `--flannel-backend=none` from k3s config, restart
- k3s re-deploys its built-in kube-router
