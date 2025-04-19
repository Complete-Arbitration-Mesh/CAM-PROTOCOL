# Deploy CAM Scheduler

```bash
helm repo add cam-local ./charts
helm upgrade --install cam-scheduler cam-local/cam-scheduler \
  --namespace cam --create-namespace
