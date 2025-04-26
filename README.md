<!-- ─────────────────────────  LOGO + STATUS  ───────────────────────── -->
<p align="center">
  <img src="https://github.com/user-attachments/assets/0243c00b-1d37-4325-afcf-db95e5c21bc1"
       width="220"
       alt="Cognitive Arbitration Mesh (CAM) logo – retro-modern neon"/>
  <br/>
  <a href="https://github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter/actions/workflows/ci.yml">
    <img src="https://github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter/actions/workflows/ci.yml/badge.svg"
         alt="CI status"/>
  </a>
  &nbsp;
  <img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg"
       alt="Apache-2.0 license"/>
</p>

# Cognitive Arbitration Mesh — **Beta**

Sub-millisecond AI task scheduler · open-core · drop-in Helm chart  
<sup>Thinks faster than Kubernetes HPA, treats GPUs fairer than FIFO queues.</sup>

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
CAM sits between your AI agents (vision, NLP, recommendation, …) and your compute
resources (GPUs, CPUs, TPUs), exposing a simple gRPC API (`SubmitIntent`) and a
lightweight client SDK.  
Under the hood it uses:

* a lock-free ring buffer
* a Hybrid Logical Clock for total ordering
* an optional **FastPath lease** mechanism

…to make every scheduling decision in **\< 1 ms**.

## Why we built it
* **Eliminate “fighting queues”** – traditional autoscalers react in seconds; CAM reacts in real time.  
* **Boost utilisation** – packing by `confidence` and `resource_need` raised GPU/CPU usage by 25-30 % in benchmarks.  
* **Fair & transparent** – each grant/delay is HMAC-signed and queryable via `/explain`.  
* **Easy to deploy** – one Helm chart, two pods, zero custom scripts.

## How it helps our AI agents
1. **Faster inference** – sub-ms back-off advice lets agents self-throttle.  
2. **Predictable SLAs** – P99 tail drops from 10-30 ms to \< 1 ms at 50 k RPS.  
3. **Priority controls** – weight high-value agents over background jobs.  
4. **Audit & compliance** – signed, queryable history for regulated workloads.

## ✨ Why CAM?
| Pain today                                                                  | How CAM fixes it                                   |
| :-------------------------------------------------------------------------- | :------------------------------------------------- |
| Vision/NLP services **fight for GPUs** at peak load                         | Arbiter loop grants slots every 50 ms → no starvation |
| Kubernetes HPA reacts in **seconds**                                        | Hybrid Logical Clock + FastPath → sub-ms decisions |
| Auditors need a **provable trail** for pre-emptions                         | Arbiter writes *inputs → decision → outcome* to etcd/Postgres |
| Over-provisioned clusters waste money                                       | +25-30 % GPU utilisation in pilots                 |

---

## 🚀 Quick Start

```bash
# 1) Create a local K8s cluster
kind create cluster --name cam-demo

# 2) Add Helm repo + install CAM
helm repo add cam https://Cognitive-Arbitration-Mesh-CAM.github.io/cam-starter/charts
helm install cam cam/cam-starter --namespace cam --create-namespace
