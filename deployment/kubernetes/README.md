# Kubernetes Deployment Configuration

This directory contains Kubernetes deployment configurations for the CAM platform.

## Prerequisites

- Kubernetes cluster (version 1.19+)
- Kubectl configured to access your cluster
- Helm (version 3+)

## Installation

### Using Helm

1. Add the CAM Helm repository:

```bash
helm repo add cam https://charts.cam-protocol.org
helm repo update
```

2. Create a `values.yaml` file with your custom configuration:

```yaml
# values.yaml
global:
  environment: production

auth:
  jwt:
    secret: "your-jwt-secret"
    expiration: 86400  # 24 hours in seconds

database:
  host: "postgres.database.svc.cluster.local"
  port: 5432
  name: "cam"
  user: "cam_user"
  # For production, consider using a secret instead of directly specifying password
  password: "your-secure-password"
  ssl: true

providers:
  openai:
    enabled: true
    # Use Kubernetes secrets for API keys
    apiKeySecretName: "openai-api-key"
    apiKeySecretKey: "api-key"
  anthropic:
    enabled: true
    apiKeySecretName: "anthropic-api-key"
    apiKeySecretKey: "api-key"
  google:
    enabled: true
    apiKeySecretName: "google-api-key"
    apiKeySecretKey: "api-key"

# Configure resources based on expected load
resources:
  arbitrationEngine:
    requests:
      cpu: "1000m"
      memory: "1Gi"
    limits:
      cpu: "2000m"
      memory: "2Gi"
  api:
    requests:
      cpu: "500m"
      memory: "512Mi"
    limits:
      cpu: "1000m"
      memory: "1Gi"

# Horizontal Pod Autoscaler configuration
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

# Ingress configuration
ingress:
  enabled: true
  className: "nginx"
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: cam.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: cam-tls
      hosts:
        - cam.example.com
```

3. Install the CAM platform:

```bash
helm install cam cam/cam-platform -f values.yaml --namespace cam --create-namespace
```

## Configuration Options

The Helm chart supports the following tiers:

- **Core**: Basic functionality
- **Professional**: Advanced features
- **Enterprise**: Enterprise-grade capabilities

To enable specific tiers:

```yaml
# values.yaml
tiers:
  core:
    enabled: true
  professional:
    enabled: true
    license: "your-professional-license-key"
  enterprise:
    enabled: false
```

## Security Recommendations

For production deployments, follow these security best practices:

1. **Use Kubernetes Secrets** for all sensitive information:

```bash
kubectl create secret generic openai-api-key --from-literal=api-key=sk-...
kubectl create secret generic anthropic-api-key --from-literal=api-key=sk-...
kubectl create secret generic jwt-secret --from-literal=secret=your-jwt-secret
```

2. **Enable Network Policies** to restrict pod-to-pod communication:

```yaml
networkPolicies:
  enabled: true
  additional:
    - name: restrict-database-access
      podSelector:
        matchLabels:
          app.kubernetes.io/component: api
      egress:
        - to:
            - podSelector:
                matchLabels:
                  app.kubernetes.io/component: database
          ports:
            - protocol: TCP
              port: 5432
```

3. **Set up RBAC** for restricted access:

```bash
kubectl apply -f rbac/
```

## Monitoring

The CAM platform includes Prometheus endpoints for monitoring. To enable:

```yaml
monitoring:
  prometheus:
    enabled: true
  serviceMonitor:
    enabled: true
    additionalLabels:
      release: prometheus
  grafana:
    enabled: true
    dashboards: true
```

## Troubleshooting

If you encounter issues with the deployment:

1. Check the pod status:
   ```bash
   kubectl get pods -n cam
   ```

2. View the logs:
   ```bash
   kubectl logs -f deployment/cam-api -n cam
   kubectl logs -f deployment/cam-arbitration -n cam
   ```

3. Verify the Kubernetes events:
   ```bash
   kubectl get events -n cam --sort-by='.lastTimestamp'
   ```

For further assistance, please refer to the [Troubleshooting Guide](/documentation/guides/troubleshooting.md) or contact support.
