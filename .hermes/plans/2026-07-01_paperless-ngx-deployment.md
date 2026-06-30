# Paperless-ngx Deployment Plan

> **For Hermes:** Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Deploy Paperless-ngx (document management system) to the k3s homelab as a GitOps-managed service at `documents.completeautomate.com`.

**Architecture:** Two Deployments from a shared image — `paperless-web` (Django/gunicorn webserver) and `paperless-consumer` (background document processor) — backed by PostgreSQL 16 and Redis 7. Persistent documents via NFS PVC. Protected by Authelia ForwardAuth.

**Tech Stack:** `ghcr.io/paperless-ngx/paperless-ngx:latest` (multi-arch ARM64), PostgreSQL 16-alpine, Redis 7-alpine, Traefik ingress, Authelia, Cloudflare tunnel.

**Repo:** `homelab-army` → `services/paperless/`

---

## Task Breakdown

### Task 1: Create namespace, PVCs, and kustomization skeleton

**Objective:** Set up the directory structure and foundation resources.

**Files:**
- Create: `services/paperless/namespace.yaml`
- Create: `services/paperless/pvc-data.yaml`
- Create: `services/paperless/kustomization.yaml`

**Step 1: Create namespace.yaml**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: paperless
```

**Step 2: Create pvc-data.yaml**

Paperless-ngx needs persistent storage for:
- `/usr/src/paperless/data` — search index, metadata (DB is external PostgreSQL)
- `/usr/src/paperless/media` — original documents, thumbnails
- `/usr/src/paperless/consume` — watched directory for new documents

Mount a single PVC at `/usr/src/paperless` and let app defaults create subdirs.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: paperless-data
  namespace: paperless
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: nfs-client
```

**Step 3: Create kustomization.yaml** (initial — will add more resources)

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - namespace.yaml
  - pvc-data.yaml
  - pvc-postgres.yaml
  - pvc-redis.yaml
  - secret.yaml
  - postgres-service.yaml
  - postgres-statefulset.yaml
  - redis-service.yaml
  - redis-statefulset.yaml
  - service.yaml
  - service-consumer.yaml
  - deployment.yaml
  - deployment-consumer.yaml
  - ingress.yaml
```

**Step 4: Verify**

```bash
ls services/paperless/*.yaml
# Expected: namespace.yaml, pvc-data.yaml, kustomization.yaml
```

---

### Task 2: Create PostgreSQL StatefulSet + Service

**Objective:** Deploy PostgreSQL 16 for Paperless-ngx, matching the Linkwarden pattern.

**Files:**
- Create: `services/paperless/pvc-postgres.yaml`
- Create: `services/paperless/postgres-service.yaml`
- Create: `services/paperless/postgres-statefulset.yaml`

**Step 1: Create pvc-postgres.yaml**

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: paperless-postgres
  namespace: paperless
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: nfs-client
```

**Step 2: Create postgres-service.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: paperless-db
  namespace: paperless
  labels:
    app: paperless-db
spec:
  type: ClusterIP
  ports:
  - port: 5432
    targetPort: 5432
    protocol: TCP
    name: postgres
  selector:
    app: paperless-db
```

**Step 3: Create postgres-statefulset.yaml**

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: paperless-db
  namespace: paperless
  labels:
    app: paperless-db
spec:
  serviceName: paperless-db
  replicas: 1
  selector:
    matchLabels:
      app: paperless-db
  template:
    metadata:
      labels:
        app: paperless-db
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 5432
          protocol: TCP
        env:
        - name: POSTGRES_DB
          value: paperless
        - name: POSTGRES_USER
          value: paperless
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: paperless-secrets
              key: postgres_password
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - paperless
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - paperless
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            cpu: 100m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes:
      - ReadWriteOnce
      storageClassName: nfs-client
      resources:
        requests:
          storage: 5Gi
```

---

### Task 3: Create Redis StatefulSet + Service

**Objective:** Deploy Redis 7 for Paperless-ngx task queue (celery/redis based).

**Files:**
- Create: `services/paperless/pvc-redis.yaml`
- Create: `services/paperless/redis-service.yaml`
- Create: `services/paperless/redis-statefulset.yaml`

**Step 1: Create pvc-redis.yaml**

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: paperless-redis
  namespace: paperless
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  storageClassName: nfs-client
```

**Step 2: Create redis-service.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: paperless-redis
  namespace: paperless
  labels:
    app: paperless-redis
spec:
  type: ClusterIP
  ports:
  - port: 6379
    targetPort: 6379
    protocol: TCP
    name: redis
  selector:
    app: paperless-redis
```

**Step 3: Create redis-statefulset.yaml**

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: paperless-redis
  namespace: paperless
  labels:
    app: paperless-redis
spec:
  serviceName: paperless-redis
  replicas: 1
  selector:
    matchLabels:
      app: paperless-redis
  template:
    metadata:
      labels:
        app: paperless-redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 6379
          protocol: TCP
        volumeMounts:
        - name: data
          mountPath: /data
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 200m
            memory: 256Mi
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes:
      - ReadWriteOnce
      storageClassName: nfs-client
      resources:
        requests:
          storage: 1Gi
```

---

### Task 4: Create k8s Secret with generated values

**Objective:** Create a local k8s Secret for Paperless-ngx with all required credentials.

**Files:**
- Create: `services/paperless/secret.yaml`

**Step 1: Generate secret values**

```bash
PAPERLESS_SECRET_KEY=$(openssl rand -base64 48)
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9')
echo "SECRET_KEY=$PAPERLESS_SECRET_KEY"
echo "DB_PASSWORD=$DB_PASSWORD"
```

**Step 2: Create secret.yaml** (fill in generated values)

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: paperless-secrets
  namespace: paperless
type: Opaque
stringData:
  PAPERLESS_SECRET_KEY: "<generated-secret-key>"
  postgres_password: "<generated-db-password>"
```

**Step 3: Verify**

```bash
kubectl apply -f services/paperless/secret.yaml --dry-run=client
# Expected: secret/paperless-secrets created (dry run)
```

**Note:** The Secret is committed to the private Git repo. No ExternalSecret or AWS cost needed.

---

### Task 5: Create the web Deployment

**Objective:** Deploy the Paperless-ngx webserver container.

**Files:**
- Create: `services/paperless/deployment.yaml`

**Step 1: Create deployment.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: paperless-web
  namespace: paperless
  labels:
    app: paperless
spec:
  replicas: 1
  selector:
    matchLabels:
      app: paperless
  template:
    metadata:
      labels:
        app: paperless
    spec:
      initContainers:
      - name: migrations
        image: ghcr.io/paperless-ngx/paperless-ngx:latest
        imagePullPolicy: Always
        command: ["paperless", "migrate"]
        envFrom:
        - secretRef:
            name: paperless-secrets
        env:
        - name: PAPERLESS_REDIS
          value: redis://paperless-redis.paperless.svc.cluster.local:6379
        - name: PAPERLESS_DBHOST
          value: paperless-db.paperless.svc.cluster.local
        - name: PAPERLESS_DBNAME
          value: paperless
        - name: PAPERLESS_DBUSER
          value: paperless
        - name: PAPERLESS_DBPASS
          valueFrom:
            secretKeyRef:
              name: paperless-secrets
              key: postgres_password
        - name: PAPERLESS_DBPORT
          value: "5432"
        - name: PAPERLESS_URL
          value: https://documents.completeautomate.com
        - name: PAPERLESS_TIME_ZONE
          value: Asia/Singapore
        - name: PAPERLESS_OCR_LANGUAGE
          value: eng
        - name: PAPERLESS_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: paperless-secrets
              key: PAPERLESS_SECRET_KEY
        volumeMounts:
        - name: data
          mountPath: /usr/src/paperless
      containers:
      - name: webserver
        image: ghcr.io/paperless-ngx/paperless-ngx:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8000
        env:
        - name: PAPERLESS_REDIS
          value: redis://paperless-redis.paperless.svc.cluster.local:6379
        - name: PAPERLESS_DBHOST
          value: paperless-db.paperless.svc.cluster.local
        - name: PAPERLESS_DBNAME
          value: paperless
        - name: PAPERLESS_DBUSER
          value: paperless
        - name: PAPERLESS_DBPASS
          valueFrom:
            secretKeyRef:
              name: paperless-secrets
              key: postgres_password
        - name: PAPERLESS_DBPORT
          value: "5432"
        - name: PAPERLESS_URL
          value: https://documents.completeautomate.com
        - name: PAPERLESS_TIME_ZONE
          value: Asia/Singapore
        - name: PAPERLESS_OCR_LANGUAGE
          value: eng
        - name: PAPERLESS_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: paperless-secrets
              key: PAPERLESS_SECRET_KEY
        volumeMounts:
        - name: data
          mountPath: /usr/src/paperless
        livenessProbe:
          httpGet:
            path: /
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /
            port: 8000
          initialDelaySeconds: 15
          periodSeconds: 10
        resources:
          requests:
            cpu: 200m
            memory: 512Mi
          limits:
            cpu: "1"
            memory: 1Gi
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: paperless-data
```

---

### Task 6: Create the consumer Deployment

**Objective:** Deploy the background document consumer process.

**Files:**
- Create: `services/paperless/deployment-consumer.yaml`
- Create: `services/paperless/service-consumer.yaml`

**Step 1: Create deployment-consumer.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: paperless-consumer
  namespace: paperless
  labels:
    app: paperless-consumer
spec:
  replicas: 1
  selector:
    matchLabels:
      app: paperless-consumer
  template:
    metadata:
      labels:
        app: paperless-consumer
    spec:
      containers:
      - name: consumer
        image: ghcr.io/paperless-ngx/paperless-ngx:latest
        imagePullPolicy: Always
        command: ["paperless", "consumer"]
        env:
        - name: PAPERLESS_REDIS
          value: redis://paperless-redis.paperless.svc.cluster.local:6379
        - name: PAPERLESS_DBHOST
          value: paperless-db.paperless.svc.cluster.local
        - name: PAPERLESS_DBNAME
          value: paperless
        - name: PAPERLESS_DBUSER
          value: paperless
        - name: PAPERLESS_DBPASS
          valueFrom:
            secretKeyRef:
              name: paperless-secrets
              key: postgres_password
        - name: PAPERLESS_DBPORT
          value: "5432"
        - name: PAPERLESS_URL
          value: https://documents.completeautomate.com
        - name: PAPERLESS_TIME_ZONE
          value: Asia/Singapore
        - name: PAPERLESS_OCR_LANGUAGE
          value: eng
        - name: PAPERLESS_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: paperless-secrets
              key: PAPERLESS_SECRET_KEY
        volumeMounts:
        - name: data
          mountPath: /usr/src/paperless
        resources:
          requests:
            cpu: 200m
            memory: 512Mi
          limits:
            cpu: "1"
            memory: 1Gi
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: paperless-data
```

**Step 2: Create service-consumer.yaml** (minimal — for metrics/internal, not exposed externally)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: paperless-consumer
  namespace: paperless
  labels:
    app: paperless-consumer
spec:
  type: ClusterIP
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
  selector:
    app: paperless-consumer
```

---

### Task 7: Create web Service and Ingress

**Objective:** Expose the webserver internally and via `documents.completeautomate.com`.

**Files:**
- Modify: `services/paperless/service.yaml` (create)
- Create: `services/paperless/ingress.yaml`

**Step 1: Create service.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: paperless-web
  namespace: paperless
  labels:
    app: paperless
spec:
  type: ClusterIP
  ports:
  - port: 8000
    targetPort: 8000
    protocol: TCP
    name: http
  selector:
    app: paperless
```

**Step 2: Create ingress.yaml**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: paperless
  namespace: paperless
  annotations:
    traefik.ingress.kubernetes.io/router.middlewares: authelia-add-https@kubernetescrd,authelia-authelia-forwardauth@kubernetescrd
spec:
  ingressClassName: traefik
  rules:
  - host: documents.completeautomate.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: paperless-web
            port:
              number: 8000
```

---

### Task 8: Register ArgoCD Application + app-of-apps

**Objective:** Wire the new service into ArgoCD GitOps.

**Files:**
- Create: `apps/paperless.yaml`
- Modify: `apps/kustomization.yaml`

**Step 1: Create apps/paperless.yaml**

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: paperless
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/vimalmenon/homelab-army.git
    targetRevision: main
    path: services/paperless
  destination:
    server: https://kubernetes.default.svc
    namespace: paperless
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

**Step 2: Edit apps/kustomization.yaml**

Add `  - paperless.yaml` in alphabetical order (between `orpheus.yaml` and `pythia.yaml` or wherever appropriate per current file content).

---

### Task 9: Update Authelia access control

**Objective:** Add `documents.completeautomate.com` to Authelia's access_control rules.

**Files:**
- Modify: `services/authelia/configmap.yaml`

**Step 1: Edit the Authelia configmap**

Add BEFORE the `*.completeautomate.com` wildcard (which has `policy: bypass`):

```yaml
- domain: documents.completeautomate.com
  policy: one_factor
```

**Step 2: Restart Authelia**

```bash
kubectl rollout restart deployment -n authelia authelia
```

---

### Task 10: Create Cloudflare DNS + Tunnel Route

**Objective:** Make `documents.completeautomate.com` publicly accessible.

**Step 1: Create DNS CNAME record**

```python
import base64, json, subprocess, urllib.request

result = subprocess.run(
    ["kubectl", "get", "secret", "-n", "tunnel-sync", "cloudflare-token",
     "-o", "jsonpath={.data.CLOUDFLARE_API_TOKEN}"],
    capture_output=True, text=True, timeout=10, check=True
)
token = base64.b64decode(result.stdout.strip()).decode()

ZONE_ID = "a632b657b02c064e937b66f0c446f132"
TUNNEL_ID = "011a9625-236e-42dc-b716-e5de75390eaa"
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Create CNAME
body = json.dumps({
    "type": "CNAME",
    "name": "documents",
    "content": f"{TUNNEL_ID}.cfargotunnel.com",
    "ttl": 1,
    "proxied": True
}).encode()
url = f"https://api.cloudflare.com/client/v4/zones/{ZONE_ID}/dns_records"
resp = urllib.request.urlopen(urllib.request.Request(url, data=body, headers=headers, method="POST"))
print(f"DNS created: {json.loads(resp.read())}")
```

**Step 2: Add tunnel ingress rule**

```python
# Fetch current config
resp = urllib.request.urlopen(
    f"https://api.cloudflare.com/client/v4/accounts/3fffdd2b812bcd8b1ee70fb599de63b7/cfd_tunnel/{TUNNEL_ID}/configurations",
    headers=headers, timeout=30)
data = json.loads(resp.read())
ingress = data["result"]["config"]["ingress"]
version = data["result"]["version"]

# Add rule before catch-all
new_rule = {"service": "http://192.168.128.200", "hostname": "documents.completeautomate.com", "originRequest": {}}
new_ingress = ingress[:-1] + [new_rule] + [ingress[-1]]

body = json.dumps({"config": {"ingress": new_ingress, "warp-routing": {"enabled": False}}}).encode()
put_req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/3fffdd2b812bcd8b1ee70fb599de63b7/cfd_tunnel/{TUNNEL_ID}/configurations",
    data=body, headers=headers, method="PUT")
resp = urllib.request.urlopen(put_req, timeout=30)
print(f"Tunnel updated to version {json.loads(resp.read())['result']['version']}")
```

---

### Task 11: Commit, Deploy & Verify

**Objective:** Push to Git, sync with ArgoCD, verify the deployment.

**Step 1: Commit and push everything**

```bash
cd /home/hermes/homelab-army
git add -A
git commit -m "feat: Add Paperless-ngx document management system

- PostgreSQL 16 for document metadata storage
- Redis 7 for task queue (celery)
- Web deployment with gunicorn on port 8000
- Consumer deployment for background document processing
- Single 10Gi PVC for document data/media/consume
- Traefik ingress at documents.completeautomate.com with Authelia
- Local k8s secrets (no AWS cost)
- Init container runs DB migrations before webserver starts"
git push
```

**Step 2: Apply the ArgoCD Application**

```bash
kubectl apply -f apps/paperless.yaml
```

**Step 3: Force ArgoCD refresh**

```bash
kubectl patch application -n argocd paperless \
  --type='merge' -p='{"metadata":{"annotations":{"argocd.argoproj.io/refresh":"hard"}}}'
```

**Step 4: Verify deployment**

```bash
# Check ArgoCD app status
kubectl get application -n argocd paperless -o wide

# Watch pods become ready
kubectl get pods -n paperless -w

# Check the ingress annotation stuck
kubectl get ingress -n paperless paperless \
  -o jsonpath='{.metadata.annotations.traefik\.ingress\.kubernetes\.io/router\.middlewares}'
# Expected: authelia-add-https@kubernetescrd,authelia-authelia-forwardauth@kubernetescrd

# Test via cluster IP
curl -sI http://192.168.128.200/ -H "Host: documents.completeautomate.com"
# Expected: 302 Found (Authelia redirect)

# Check consumer logs
kubectl logs -n paperless deploy/paperless-consumer --tail 20
```

---

### Post-Deployment Setup

After the service is running, Vimal must:
1. Visit `https://documents.completeautomate.com` and create a superuser
2. Run `docker exec` or `kubectl exec` to create the initial admin:
   ```bash
   kubectl exec -n paperless deploy/paperless-web -- paperless createsuperuser
   ```
3. Configure document sources, mail rules, and storage paths in the UI

---

## Risks & Open Questions

| Risk | Mitigation |
|------|-----------|
| Init container migration fails | Check DB connectivity before running `paperless migrate` |
| First startup slow (image pull + DB init) | Set liveness probe `initialDelaySeconds: 30` |
| Consumer doesn't pick up documents | Check consumer logs for Redis/DB connectivity errors |
| NFS performance for document storage | Monitor I/O; if slow, consider local-path storage class |
| Authelia 401 instead of redirect | Verify `add-https` middleware is present in ingress annotation |
| Paperless-ngx ARM64 compatibility | Image is multi-arch (confirmed on docs) |
