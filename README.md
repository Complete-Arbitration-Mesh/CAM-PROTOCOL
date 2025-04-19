<!-- ─────────────────────────  LOGO  ───────────────────────── -->
<p align="center">
  <img src="https://github.com/user-attachments/assets/0243c00b-1d37-4325-afcf-db95e5c21bc1" width="220" alt="Cognitive Arbitration Mesh (CAM) logo – retro‑modern neon">
</p>

<h1 align="center">
  Cognitive Arbitration Mesh — <strong>CAM‑Starter</strong>
</h1>
<p align="center">
  <em>Sub‑millisecond AI task scheduler · open‑core · drop‑in Helm chart</em><br>
  <sup>Thinks faster than Kubernetes HPA, treats GPUs fairer than FIFO queues.</sup>
</p>

<p align="center">
  <a href="https://github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter/actions/workflows/ci.yaml">
    <img src="https://github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter/actions/workflows/ci.yaml/badge.svg" alt="CI status" />
  </a>
  &nbsp;
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="Apache‑2.0 licence" />
  </a>
  &nbsp;
  <a href="https://goreportcard.com/report/github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter">
    <img src="https://goreportcard.com/badge/github.com/Cognitive-Arbitration-Mesh-CAM/cam-starter" alt="Go report" />
  </a>
</p>

---

<h2>What it is:</h2>
<p>
  CAM sits between your AI agents (vision, NLP, recommendation, etc.) and your compute resources (GPUs, CPUs, TPUs), exposing a simple gRPC API (<code>SubmitIntent</code>) and a lightweight client SDK. Under the hood, it uses a lock-free ring buffer, a Hybrid Logical Clock for total ordering, and an optional FastPath lease mechanism to make every scheduling decision in under 1 ms.
</p>

<h2>Why we built it:</h2>
<ul>
  <li><strong>Eliminate “fighting queues”</strong>: Traditional autoscalers react in seconds—too slow for bursty inference. CAM makes per-request decisions in real time, ensuring critical tasks aren’t delayed by lower priority jobs.</li>
  <li><strong>Boost utilization</strong>: By intelligently packing intents based on explicit confidence and <code>resource_need</code> attributes, we’ve seen 25–30% improvements in GPU/CPU utilization in our benchmarks.</li>
  <li><strong>Ensure fairness & transparency</strong>: Every grant or delay is logged with full metadata and HMAC-protected. You get a provable audit trail—and an <code>/explain</code> API to drill into why each decision was made.</li>
  <li><strong>Scale easily</strong>: Deployable with a single Helm chart, runs as two lightweight pods, and integrates seamlessly with Kubernetes, service meshes, or any CI/CD pipeline.</li>
</ul>

<h2>How it helps our AI agents:</h2>
<ol>
  <li><strong>Faster inference</strong>: Agents get immediate grant or back-off guidance in under a millisecond, letting them adapt and queue more intelligently.</li>
  <li><strong>Predictable SLAs</strong>: P99 tail latency drops from tens of milliseconds to sub-millisecond even under 50k RPS, so real-time services stay responsive.</li>
  <li><strong>Priority controls</strong>: You can weight “high value” agents (e.g., fraud detection) above “background” agents (e.g., nightly retraining) with a single configuration flag—no custom scripts required.</li>
  <li><strong>Audit & compliance</strong>: For regulated domains (healthcare, finance), every scheduling decision is stored, signed, and queryable—no more black box delays.</li>
</ol>

<h2>In short:</h2>
<p>
  CAM gives our agents a policy-driven arbitration mesh that’s as fast as it is fair, so we can focus on building smarter models without worrying about resource contention. Let’s start migrating our inference clients to the new SDK and watch our performance—and confidence—skyrocket!
</p>

<p><strong>Best,</strong><br>Dru</p>

<hr>

<h2>✨ Why CAM?</h2>

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
      <td>Arbitration loop decides who wins each 50 ms slot — no starvation.</td>
    </tr>
    <tr>
      <td>Kubernetes HPA reacts in <strong>seconds</strong>, not milliseconds.</td>
      <td>Hybrid Logical Clock + FastPath lease → sub-ms decisions.</td>
    </tr>
    <tr>
      <td>Auditors want a <strong>provable trail</strong> for every pre-emption.</td>
      <td>Arbiter writes <em>inputs → decision → outcome</em> to etcd/Postgres.</td>
    </tr>
    <tr>
      <td>Over-provisioned clusters waste money.</td>
      <td>+18–30% GPU utilization demonstrated in pilot benchmarks.</td>
    </tr>
  </tbody>
</table>

<hr>

<h2>🚀 Quick Start (⏱ ≈10 min)</h2>

<pre>
<code>
# 1 / create a local K8s cluster
kind create cluster --name cam-demo

# 2 / add Helm repo + install CAM
helm repo add cam https://Cognitive-Arbitration-Mesh-CAM.github.io/cam-starter/charts
helm install cam cam/cam-starter

# 3 / run demo agents (Python)
python -m venv venv && source venv/bin/activate
pip install cam-sdk
python demo/agents/vision_agent.py &
python demo/agents/planner_agent.py &

# 4 / open Grafana (admin / prom-operator)
kubectl port-forward svc/kube-prom-grafana 3000:80 &
open http://localhost:3000
</code>
</pre>

</body>
</html>
