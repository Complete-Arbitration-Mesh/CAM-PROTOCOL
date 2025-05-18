# CAM Platform: Monitoring and Observability

This guide will help you set up monitoring and observability for your CAM deployment.

## Monitoring Architecture

The CAM Platform includes a comprehensive monitoring solution based on:

- **Prometheus**: For metrics collection and alerting
- **Grafana**: For visualization and dashboards
- **OpenTelemetry**: For distributed tracing
- **Loki**: For log aggregation (optional)

## Quick Setup

### Using Docker Compose

The CAM Platform's Docker Compose setup includes monitoring components:

```bash
# Start the platform with monitoring enabled
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

This will start:
- Prometheus server on port 9090
- Grafana on port 3000
- Loki (if enabled) on port 3100

Default Grafana credentials:
- Username: `admin`
- Password: `admin` (you'll be prompted to change on first login)

### Using Kubernetes

If you're using the Kubernetes deployment:

```bash
# Add the Prometheus Operator and monitoring stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install the stack
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --values monitoring/kubernetes/values.yaml
```

## Recommended Dashboards

The CAM Platform includes pre-configured dashboards for:

1. **CAM Overview**: General health and performance
2. **Arbitration Metrics**: Routing decisions and latency
3. **Provider Performance**: Provider-specific metrics
4. **System Resources**: CPU, memory, and network usage
5. **Error Tracking**: Real-time error monitoring

To import these dashboards to your Grafana instance:

1. Navigate to Grafana (http://localhost:3000 by default)
2. Go to Dashboards > Import
3. Upload the JSON files from `monitoring/dashboards/`

## Key Metrics

These are the most important metrics to monitor:

### Performance Metrics

- `cam_arbitration_latency_ms`: Time taken for arbitration decisions
- `cam_request_latency_ms{provider="..."}`: Request latency per provider
- `cam_token_usage{model="..."}`: Token usage per model
- `cam_requests_total{status="..."}`: Total requests by status

### Resource Utilization

- `process_cpu_seconds_total`: CPU usage
- `process_resident_memory_bytes`: Memory usage
- `process_open_fds`: Open file descriptors
- `go_goroutines` / `nodejs_eventloop_lag`: Runtime-specific metrics

### Business Metrics

- `cam_cost_total{provider="..."}`: Total cost per provider
- `cam_failover_count_total`: Number of failover events
- `cam_provider_errors_total{provider="..."}`: Provider errors

## Setting Up Alerts

### Prometheus Alerts

CAM includes predefined alert rules in `monitoring/prometheus/rules.yml`:

```yaml
groups:
- name: cam-alerts
  rules:
  - alert: HighErrorRate
    expr: sum(rate(cam_requests_total{status="error"}[5m])) / sum(rate(cam_requests_total[5m])) > 0.05
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"
      description: "Error rate is above 5% for the last 5 minutes"
      
  - alert: SlowArbitration
    expr: histogram_quantile(0.95, sum(rate(cam_arbitration_latency_ms_bucket[5m])) by (le)) > 50
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Slow arbitration detected"
      description: "95th percentile arbitration latency is above 50ms for the last 5 minutes"
```

To add custom alerts, modify this file and reload Prometheus.

### Email Notifications

To configure email notifications:

1. Edit `monitoring/alertmanager/config.yml`:

```yaml
receivers:
- name: 'email'
  email_configs:
  - to: 'alerts@your-company.com'
    from: 'cam-monitoring@your-company.com'
    smarthost: 'smtp.your-company.com:587'
    auth_username: 'your-username'
    auth_password: 'your-password'
    
route:
  receiver: 'email'
  group_by: ['alertname', 'job']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
```

2. Restart AlertManager:

```bash
docker-compose restart alertmanager
```

## Distributed Tracing

CAM uses OpenTelemetry for distributed tracing:

1. Enable tracing in your CAM configuration:

```json
{
  "observability": {
    "tracing": {
      "enabled": true,
      "exporter": "jaeger",
      "endpoint": "http://jaeger:14268/api/traces"
    }
  }
}
```

2. Access the Jaeger UI at http://localhost:16686

## Log Management

### Accessing Logs

#### Docker Deployment

```bash
# View logs for all services
docker-compose logs

# View logs for a specific service
docker-compose logs -f cam-api

# Filter logs
docker-compose logs -f cam-api | grep ERROR
```

#### Kubernetes Deployment

```bash
# View logs for a specific pod
kubectl logs -f deployment/cam-api -n cam

# View logs from all pods with a label
kubectl logs -f -l app.kubernetes.io/name=cam -n cam
```

### Log Aggregation with Loki

If you're using Loki for log aggregation:

1. Add a Grafana data source:
   - Type: Loki
   - URL: http://loki:3100

2. Use LogQL to query logs:
   - `{container="cam-api"} |= "error"`
   - `{app="cam"} | json | level="error"`

## Custom Monitoring

### Adding Custom Metrics

To add custom metrics to your CAM deployment:

#### TypeScript Example

```typescript
import { Registry, Counter, Histogram } from 'prom-client';

const register = new Registry();

// Define metrics
const requestCounter = new Counter({
  name: 'my_custom_requests_total',
  help: 'Total requests to my custom endpoint',
  labelNames: ['status', 'endpoint'],
  registers: [register]
});

// Use the metric
app.get('/api/custom', (req, res) => {
  // Your code...
  requestCounter.inc({ status: 'success', endpoint: '/api/custom' });
  res.send('Success');
});
```

#### Python Example

```python
from prometheus_client import Counter, Histogram

# Define metrics
request_counter = Counter(
    'my_custom_requests_total',
    'Total requests to my custom endpoint',
    ['status', 'endpoint']
)

# Use the metric
@app.route('/api/custom')
def custom_endpoint():
    # Your code...
    request_counter.labels(status='success', endpoint='/api/custom').inc()
    return 'Success'
```

## Troubleshooting

### Prometheus Isn't Scraping Metrics

1. Check that your services are exposing a metrics endpoint (usually `/metrics`)
2. Verify Prometheus configuration:
   ```bash
   curl -X POST http://localhost:9090/-/reload
   ```
3. Check Prometheus targets page: http://localhost:9090/targets

### Grafana Isn't Showing Data

1. Verify the Prometheus data source is correctly configured
2. Check that queries are returning data in the Explore view
3. Adjust the time range in the dashboard

### High Cardinality Issues

If you see warnings about high cardinality:

1. Review your label usage - avoid using high cardinality labels like user IDs
2. Consider using recording rules to pre-aggregate data
3. Adjust Prometheus storage settings if needed

## Next Steps

- [Configure advanced alerting](/documentation/guides/advanced-alerting)
- [Set up multi-cluster monitoring](/documentation/guides/multi-cluster)
- [Implement custom dashboards](/documentation/guides/custom-dashboards)
- [Performance tuning for monitoring stack](/documentation/guides/monitoring-performance)
