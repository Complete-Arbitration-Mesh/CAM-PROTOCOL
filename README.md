# Cognitive Arbitration Mesh (CAM)

<p align="center">
  <img src="https://github.com/user-attachments/assets/0243c00b-1d37-4325-afcf-db95e5c21bc1" width="220" alt="CAM logo"/>
</p>

[![CI](https://img.shields.io/github/actions/workflow/status/Cognitive-Arbitration-Mesh-CAM/cam-starter/ci.yml?branch=main&label=CI)](https://github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

---

## Table of Contents
- [What it is](#what-it-is)
- [Why we built it](#why-we-built-it)
- [How it helps AI agents](#how-it-helps-ai-agents)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Architecture](#architecture)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## What it is
CAM sits between your AI agents (vision, NLP, recommendation, …) and compute resources (GPUs, CPUs, TPUs). It exposes a simple gRPC API (`SubmitIntent`) and makes every scheduling decision in **< 1 ms** using a lock-free ring buffer + Hybrid Logical Clock.

## Why we built it
- **Stop “fighting queues”** – real-time arbitration every 50 ms.
- **Boost utilization** – +25-30 % GPU/CPU in pilots.
- **Provable fairness** – every decision signed & audit-stored.
- **Drop-in** – one Helm chart, no sidecars required.

---

## Quick Start
```bash
# 1) Create a local K8s cluster
kind create cluster --name cam-demo

# 2) Add Helm repo + install CAM
helm repo add cam https://Cognitive-Arbitration-Mesh-CAM.github.io/cam-starter/charts
helm install cam cam/cam-starter --namespace cam --create-namespace

# 3) Run demo agents (Python)
python -m venv venv && source venv/bin/activate
pip install cam-sdk
python demo/agents/vision_agent.py &
python demo/agents/planner_agent.py &

# 4) Open Grafana (admin/prom-operator)
kubectl port-forward svc/kube-prom-grafana 3000:80 -n cam
open http://localhost:3000
