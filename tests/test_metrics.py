# tests/test_metrics.py
import time
import urllib.request
from prometheus_client import start_http_server
from src.core.scheduler import Scheduler

METRICS_PORT = 8001

def test_prometheus_metrics():
    # Start metrics endpoint
    start_http_server(METRICS_PORT)

    sched = Scheduler()
    # Enqueue 3 jobs
    for i in range(3):
        sched.enqueue(f"job{i}", priority=0)

    # Give Prometheus client a moment to gather metrics
    time.sleep(0.1)

    body = urllib.request.urlopen(f"http://localhost:{METRICS_PORT}/metrics").read().decode()
    assert "cam_queue_length 3.0" in body
