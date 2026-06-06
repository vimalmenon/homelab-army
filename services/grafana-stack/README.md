# Grafana + Prometheus Stack

This directory contains the Helm values for deploying the
**kube-prometheus-stack** chart (`prometheus-community/kube-prometheus-stack`)
via **ArgoCD** in the `monitoring` namespace.

## Deployment Method

This service uses **ArgoCD with native Helm support**, not Kustomize.

- The `kustomization.yaml` file is a **placeholder** only — it exists for
  directory structure consistency but has no active resources.
- All configuration is in `values.yaml`.

## ArgoCD Application

The ArgoCD `Application` manifest (defined elsewhere, e.g., in
`infrastructure/argocd/apps/`) should reference:

- **Source**: `prometheus-community/kube-prometheus-stack` Helm chart
- **Values**: `values.yaml` in this directory
- **Destination**: `monitoring` namespace

## Extracted Configuration

This configuration was extracted from a live cluster running:

| Component            | Version / Chart                          |
|----------------------|------------------------------------------|
| kube-prometheus-stack| `86.1.0`                                 |
| Grafana              | `13.0.1-security-01` (subchart `grafana-12.4.1`) |
| Prometheus           | `v3.12.0-distroless`                     |
| Prometheus Operator  | `v0.91.0`                                |
| kube-state-metrics   | `v2.19.0`  (subchart `kube-state-metrics-7.4.0`) |
| node-exporter        | `v1.11.1`  (subchart `prometheus-node-exporter-4.55.0`) |

## Key Settings

- **Grafana domain**: `grafana.completeautomate.com`
- **Grafana root URL**: `https://grafana.completeautomate.com`
- **Prometheus retention**: 7 days (no persistent volume — uses emptyDir)
- **SMTP**: Zoho mail (`smtp.zoho.com:465`) for alert notifications
- **Alerting**: Grafana-managed alerting (not Alertmanager) with email to
  `hello@completeautomate.com`

## ⚠️ Placeholders

The following values in `values.yaml` use placeholders and **must** be replaced
via ArgoCD Vault, SealedSecrets, or External Secrets:

- `GRAFANA_ADMIN_PASSWORD` — Grafana admin password
- `GRAFANA_SMTP_PASSWORD` — SMTP password for Zoho mail

## Alerting Rules

Custom Grafana-managed alert rules are defined in:

- **`values.yaml`** (under `grafana.alerting`) — inline for Helm deployment
- **`alerting-rules.yaml`** — standalone extracted copy of the original
  `grafana-alerting-provisioning` ConfigMap contents

The rules cover:
1. **Node Down**: Alerts when a Kubernetes node is NotReady for >2 minutes
2. **Pod Pending**: Alerts when a pod is stuck in Pending state for >2 minutes
3. **Pod Crash Looping**: Alerts when a container restarts >3 times in 5 minutes

## Included Files

| File                  | Purpose                                         |
|-----------------------|-------------------------------------------------|
| `values.yaml`         | Helm values for kube-prometheus-stack           |
| `alerting-rules.yaml` | Extracted Grafana alerting provisioning config  |
| `kustomization.yaml`  | Placeholder (ArgoCD uses Helm, not Kustomize)  |
| `README.md`           | This file                                      |
