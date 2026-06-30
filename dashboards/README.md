# Grafana Dashboards

This directory contains Grafana dashboard JSON files managed as GitOps ConfigMaps.

## How it works

1. Each `.json` file in this directory is a Grafana dashboard definition
2. Kustomize generates a **ConfigMap** from each JSON file (`configMapGenerator`)
3. The ConfigMap is labelled `grafana_dashboard: "1"`
4. The **Grafana sidecar** (`grafana-sc-dashboard`) in the monitoring namespace watches for ConfigMaps with this label and automatically imports them into Grafana

No manual import needed — just add the JSON file here, add it to `kustomization.yaml`, commit, and push. ArgoCD syncs the ConfigMap, the sidecar picks it up, and the dashboard appears in Grafana.

## Adding a new dashboard

1. Export the dashboard JSON from Grafana (Dashboard → Share → Export → Save to file)
2. Copy the file to this directory: `dashboards/<name>.json`
3. Add it to `kustomization.yaml`:
   ```yaml
   - name: dashboard-<name>
     files:
       - <name>.json
   ```
4. Commit and push — ArgoCD handles the rest

## Restoring dashboards (disaster recovery)

### If Grafana pod is lost but PVC survives
ArgoCD re-syncs the ConfigMaps → sidecar re-imports → dashboards reappear automatically.

### If Grafana PVC is lost (full data loss)
1. ArgoCD re-creates the Grafana deployment and PVC
2. ArgoCD syncs ConfigMaps from this directory
3. Grafana sidecar imports all dashboards automatically
4. All datasources and alerting rules come from their respective ConfigMaps in `services/grafana-stack/`

**No manual steps needed** — the system self-heals.

### If the whole cluster is lost
1. Restore the cluster from the k3s-server backup (see `services/k3s-server-backup/restore.md`)
2. ArgoCD syncs all applications
3. Dashboards are recreated from this Git directory

## Current dashboards

| ConfigMap Name | Dashboard | File |
|----------------|-----------|------|
| `dashboard-k3s-cluster` | K3s Cluster Resources | `k3s-cluster-resources.json` |
| `dashboard-atlas` | Atlas | `atlas.json` |
| `dashboard-iris` | Iris | `iris.json` |
| `dashboard-pihole-dns` | Pi-hole DNS | `pihole.json` |
| `dashboard-nfs-storage` | NFS Storage Kanban | `nfs-storage.json` |
