# K3s Server Disaster Recovery

## What's backed up

```
s3://completeautomate-media/backups/k3s-server/YYYY-MM-DD/k3s-server-backup.tar.gz
```

Contains:
- `server/db/state.db` + WAL — main SQLite cluster state
- `server/token` — cluster join token
- `server/tls/` — all TLS certificates and keys (CA, client, server)
- `server/cred/` — kubeconfigs and credentials

## Full restore procedure

### Prerequisites
- A fresh Debian Pi with k3s installed (`curl -sfL https://get.k3s.io | sh -`)
- The latest backup downloaded from S3
- Root access on the Pi

### Steps

1. **Stop k3s** (if running):
   ```bash
   sudo systemctl stop k3s
   ```

2. **Restore the backup**:
   ```bash
   # Download latest backup
   aws s3 cp s3://completeautomate-media/backups/k3s-server/LATEST/k3s-server-backup.tar.gz /tmp/
   
   # Extract
   tar -xzf /tmp/k3s-server-backup.tar.gz -C /tmp
   
   # Back up current state (just in case)
   sudo mv /var/lib/rancher/k3s/server /var/lib/rancher/k3s/server.bak
   
   # Restore
   sudo mkdir -p /var/lib/rancher/k3s/server
   sudo cp -a /tmp/server/* /var/lib/rancher/k3s/server/
   sudo chown -R root:root /var/lib/rancher/k3s/server
   ```

3. **Start k3s**:
   ```bash
   sudo systemctl start k3s
   ```

4. **Verify cluster health**:
   ```bash
   kubectl get nodes
   kubectl get pods -A
   ```

5. **Worker nodes** (if they didn't auto-rejoin):
   ```bash
   # On homelab01, get the node token
   sudo cat /var/lib/rancher/k3s/server/token
   
   # On each worker node, rejoin
   curl -sfL https://get.k3s.io | K3S_URL=https://192.168.128.54:6443 K3S_TOKEN=<TOKEN> sh -
   ```

### Notes
- TLS certificates are the same after restore, so existing kubeconfigs and worker nodes remain valid
- If restoring to a different IP address, update kubeconfigs with the new server IP
- Backups retained for 30 days
