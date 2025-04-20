<!-- ─────────────────────────  LOGO  ───────────────────────── -->
<p align="center">
  <img src="https://github.com/user-attachments/assets/0243c00b-1d37-4325-afcf-db95e5c21bc1" width="220" alt="Cognitive Arbitration Mesh (CAM) logo – retro‑modern neon">
</p>

<h1 align="center">
  Cognitive Arbitration Mesh — CAM‑Starter
</h1>
<p align="center">
  Sub‑millisecond AI task scheduler · open‑core · drop‑in Helm chart <br>
  <sup>Thinks faster than Kubernetes HPA, treats GPUs fairer than FIFO queues.</sup>
</p>

<p align="center">
  <a href="https://github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter/actions/workflows/ci.yaml">
    <img src="https://github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter/actions/workflows/ci.yaml/badge.svg" alt="CI status"/>
  </a>
  &nbsp;
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="Apache‑2.0 license" />
  </a>
  &nbsp;
  <a href="https://goreportcard.com/report/github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter">
    <img src="https://goreportcard.com/badge/github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter" alt="Go report" />
  </a>
</p>

---

## 📑 Table of Contents
- [What it is](#what-it-is)
- [Why we built it](#why-we-built-it)
- [How it helps our AI agents](#how-it-helps-our-ai-agents)
- [✨ Why CAM?](#why-cam)
- [🚀 Quick Start](#quick-start)
- [🛠️ Installation & Configuration](#installation--configuration)
- [📦 Helm Chart Reference](#helm-chart-reference)
- [💻 SDK Usage Examples](#sdk-usage-examples)
- [🗺️ Architecture](#architecture)
- [📈 Performance](#performance)
- [🛡️ Security](#security)
- [🔧 Troubleshooting & FAQ](#troubleshooting--faq)
- [🚧 Roadmap](#roadmap)
- [🤝 Contributing](#contributing)
- [📄 License](#license)

---

## What it is
CAM sits between your AI agents (vision, NLP, recommendation, etc.) and your compute resources (GPUs, CPUs, TPUs), exposing a simple gRPC API (`SubmitIntent`) and a lightweight client SDK. Under the hood, it uses a lock-free ring buffer, a Hybrid Logical Clock for total ordering, and an optional FastPath lease mechanism to make every scheduling decision in under 1 ms.

## Why we built it
- **Eliminate “fighting queues”**: Traditional autoscalers react in seconds—too slow for bursty inference. CAM makes per-request decisions in real time, ensuring critical tasks aren’t delayed by low-priority jobs.
- **Boost utilization**: By packing intents based on explicit `confidence` and `resource_need` attributes, we’ve seen 25–30% improvements in GPU/CPU utilization in benchmarks.
- **Ensure fairness & transparency**: Every grant or delay is logged with full metadata and HMAC-protected. You get a provable audit trail—and an `/explain` API to drill into decision rationale.
- **Scale easily**: Deployable with a single Helm chart, runs as two lightweight pods, integrates seamlessly with Kubernetes, service meshes, or any CI/CD pipeline.

## How it helps our AI agents
1. **Faster inference**: Agents get immediate grant or back-off guidance in under a millisecond, letting them adapt and queue more intelligently.
2. **Predictable SLAs**: P99 tail latency drops from tens of milliseconds to sub-millisecond even under 50 k RPS, so real-time services stay responsive.
3. **Priority controls**: Weight “high value” agents (e.g., fraud detection) above “background” agents (e.g., nightly retraining) with one configuration—no custom scripts required.
4. **Audit & compliance**: For regulated domains (healthcare, finance), every scheduling decision is stored, signed, and queryable—no more black-box delays.

## ✨ Why CAM?
<table>
  <thead>
    <tr>
      <th>Pain today</th>
      <th>How CAM fixes it</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Vision, NLP, recommender services <strong>fight for GPUs</strong> at peak load.</td>
      <td>Arbitration loop decides who wins each 50 ms slot—no starvation.</td>
    </tr>
    <tr>
      <td>Kubernetes HPA reacts in <strong>seconds</strong>, not milliseconds.</td>
      <td>Hybrid Logical Clock + FastPath lease → sub‑ms decisions.</td>
    </tr>
    <tr>
      <td>Auditors want a <strong>provable trail</strong> for every pre-emption.</td>
      <td>Arbiter writes <em>inputs → decision → outcome</em> to etcd/Postgres.</td>
    </tr>
    <tr>
      <td>Over-provisioned clusters waste money.</td>
      <td>+25–30% GPU utilization demonstrated in pilot benchmarks.</td>
    </tr>
  </tbody>
</table>

## 🚀 Quick Start
```bash
# 1) Create a local K8s cluster
kind create cluster --name cam-demo

# 2) Add Helm repo + install CAM
helm repo add cam https://Cognitive-Arbitration-Mesh-CAM.github.io/cam-starter/charts
helm install cam cam/cam-starter --namespace cam --create-namespace

# 3) Run demo agents (Python)
python -m venv venv && source venv/bin/activate
pip install cam-sdk
data
python demo/agents/vision_agent.py &
python demo/agents/planner_agent.py &

# 4) Open Grafana (admin/prom-operator)
kubectl port-forward svc/kube-prom-grafana 3000:80 -n cam
open http://localhost:3000
```

## 🛠️ Installation & Configuration
### Prerequisites
- Kubernetes v1.24+
- Helm v3.8+ (or `kubectl kustomize`)
- Cert‑Manager (for mTLS) or your own TLS certs

### Helm Chart
```bash
helm repo add cam https://Cognitive-Arbitration-Mesh-CAM.github.io/cam-starter/charts
helm install cam cam/cam-starter \
  --namespace cam --create-namespace \
  --set tls.enabled=true \
  --set lease.enabled=true
```

### Configuration via `values.yaml`
```yaml
replicaCount: 2
fastPath:
  enabled: true
  maxLeasesPerSec: 50
resources:
  requests:
    cpu: 100m
    memory: 200Mi
  limits:
    cpu: 200m
    memory: 400Mi
networkPolicy:
  enabled: true
  cidrs: ["10.0.0.0/16","192.168.1.0/24"]
serviceMonitor:
  enabled: true
  interval: 15s
securityContext:
  runAsNonRoot: true
  readOnlyRootFilesystem: true
```

## 📦 Helm Chart Reference
| Key                        | Default     | Description                                       |
|----------------------------|------------:|---------------------------------------------------|
| `replicaCount`            | `2`         | Number of arbiter pods                            |
| `fastPath.enabled`         | `false`     | Enable lease bypass                               |
| `fastPath.maxLeasesPerSec` | `100`       | Lease rate limit per agent                        |
| `resources.requests.cpu`   | `100m`      | CPU request                                       |
| `resources.limits.cpu`     | `150m`      | CPU limit                                         |
| `networkPolicy.enabled`    | `false`     | Enable NetworkPolicy                              |
| `serviceMonitor.enabled`   | `false`     | Create Prometheus ServiceMonitor                  |

## 💻 SDK Usage Examples
### Go
```go
import (
  "context"
  "crypto/tls"
  "fmt"
  "time"

  camv1 "github.com/cam-mesh/cam-starter/api/v1"
  "google.golang.org/grpc"
)

func main() {
  creds := grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{/*...*/}))
  conn, _ := grpc.Dial("cam.cam.svc:50051", creds)
  defer conn.Close()
  client := camv1.NewArbiterClient(conn)

  tok := &camv1.IntentToken{AgentId: "vision", Confidence: 0.9, ResourceNeed: 20}
  ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
  defer cancel()
  res, err := client.SubmitIntent(ctx, tok)
  fmt.Println(res.Accepted, res.WaitTimeMs, err)
}
``` 

### Python
```python
from cam_sdk import CAMClient, Intent

client = CAMClient(
    address="cam.cam.svc:50051",
    tls_cert="/etc/cam/tls.crt",
    tls_key="/etc/cam/tls.key"
)
tok = Intent(
    agent_id="vision",
    intent_type="vision_infer",
    confidence=0.9,
    resource_need_ms=20
)
resp = client.submit(tok)
print(resp.granted, resp.wait_time_ms)
```

## 🗺️ Architecture
```
Agents → gRPC → CAM Arbiter (pods)
                            ↓
                 bbolt / etcd (audit store)
                            ↓
               Prometheus → Grafana Dashboard
```

Core components:
- **RingBuffer** (lock‑free, O(1) enqueue/dequeue)
- **Hybrid Logical Clock** (48‑bit physical + 16‑bit logical)
- **FastPath leases** (JWT for micro‑burst bypass)
- **Audit store** (bbolt or etcd)

## 📈 Performance
| Mode               | P99 Latency | Throughput   | Notes                       |
|--------------------|------------:|-------------:|-----------------------------|
| No FastPath        | 8.4 ms      | 18 k RPS     | bbolt sync overhead         |
| FastPath enabled   | 0.95 ms     | 78 k RPS     | lease bypass                |
| 2-replica etcd     | 1.2 ms      | 70 k RPS     | network reconciliation cost |

## 🛡️ Security
- **mTLS** enforced via cert-manager or provided TLS secrets
- **HMAC signing** on all tokens
- **NetworkPolicy** to restrict ingress/egress
- **PodSecurityContext & SecurityContext** for non‑root, read‑only FS
- **RBAC**: minimal ServiceAccount, Role, RoleBinding

## 🔧 Troubleshooting & FAQ
**Q**: `lease rate limit exceeded`  
**A**: Increase `fastPath.maxLeasesPerSec` or throttle agent submission rate.

**Q**: `Invalid HMAC signature`  
**A**: Ensure the HMAC key in Kubernetes secret matches the client SDK key.

**Q**: How to rotate keys?  
- Update Secret’s `cam.example.com/rotation` annotation.  
- Helm upgrade or restart pods to pick up new keys.

## 🚧 Roadmap
- [ ] eBPF dataplane GA  
- [ ] OPA policy hub integration  
- [ ] SRAS resource-credit ledger  
- [ ] CNCF Sandbox proposal

## 🤝 Contributing
We welcome PRs and issues!
- 📋 See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines  
- 🛡️ Review [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)  
- 🎯 Check the [Project Board](https://github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter/projects/1)

## 📄 License
This project is licensed under the [Apache 2.0 License](LICENSE).
