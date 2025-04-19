<!-- ─────────────────────────  LOGO  ───────────────────────── -->
<p align="center">
  <img src="https://github.com/user-attachments/assets/0243c00b-1d37-4325-afcf-db95e5c21bc1" width="220" alt="Cognitive Arbitration Mesh (CAM) logo – retro‑modern neon">
</p>

<h1 align="center">
  Cognitive Arbitration Mesh — <strong>CAM‑Starter</strong>
</h1>
<p align="center">
  <em>Sub‑millisecond AI task scheduler · open‑core · drop‑in Helm chart</em><br>
  <sup>Thinks faster than Kubernetes HPA, treats GPUs fairer than FIFO queues.</sup>
</p>

<p align="center">
  <a href="https://github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter/actions/workflows/ci.yaml">
    <img src="https://github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter/actions/workflows/ci.yaml/badge.svg"
         alt="CI status" />
  </a>
  &nbsp;
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg"
         alt="Apache‑2.0 licence" />
  </a>
  &nbsp;
  <a href="https://goreportcard.com/report/github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter">
    <img src="https://goreportcard.com/badge/github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter"
         alt="Go report" />
  </a>
</p>

---

## ✨ Why CAM?

| Pain today | How CAM fixes it |
|------------|------------------|
| Vision, NLP, recommender services **fight for GPUs** at peak load. | Arbitration loop decides who wins each 50 ms slot &mdash; no starvation. |
| Kubernetes HPA reacts in **seconds**, not milliseconds. | Hybrid Logical Clock + FastPath lease → sub‑ms decisions. |
| Auditors want a **provable trail** for every pre‑emption. | Arbiter writes *inputs → decision → outcome* to etcd / Postgres. |
| Over‑provisioned clusters waste money. | +18–30 % GPU utilisation demonstrated in pilot benchmarks. |

---

## 🚀 Quick Start (⏱ ≈10 min)

```bash
# 1 / create a local K8s cluster
kind create cluster --name cam-demo

# 2 / add Helm repo + install CAM
helm repo add cam https://Cognitive-Arbitration-Mesh-CAM.github.io/cam-starter/charts
helm install cam cam/cam-starter

# 3 / run demo agents (Python)
python -m venv venv && source venv/bin/activate
pip install cam-sdk
python demo/agents/vision_agent.py &
python demo/agents/planner_agent.py &

# 4 / open Grafana (admin / prom-operator)
kubectl port-forward svc/kube-prom-grafana 3000:80 &
open http://localhost:3000
