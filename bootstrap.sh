#!/bin/bash
set -euo pipefail

echo "🚀 Deploying homelab-army..."

# Step 1: Install ArgoCD
echo "📦 Installing ArgoCD..."
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/v3.4.3/manifests/install.yaml

# Step 2: Wait for ArgoCD
echo "⏳ Waiting for ArgoCD to be ready..."
kubectl wait --for=condition=Available -n argocd deploy/argocd-server --timeout=180s

# Step 3: Apply ingress and root app
echo "🔗 Applying ingress..."
kubectl apply -f argocd/ingress.yaml

echo "🌱 Bootstrapping root Application..."
kubectl apply -f apps/root.yaml

echo "✅ homelab-army deployed! ArgoCD is syncing."
echo "   Access: https://argocd.completeautomate.com"
echo "   Default password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d"
