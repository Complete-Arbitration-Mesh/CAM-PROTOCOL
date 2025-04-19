import threading
import time
import grpc
from src.server.app import serve
from src import scheduler_pb2, scheduler_pb2_grpc

PORT = 50055

def _start_server():
    serve(PORT)

def _client():
    channel = grpc.insecure_channel(f"localhost:{PORT}")
    return scheduler_pb2_grpc.SchedulerStub(channel)

def test_grpc_roundtrip():
    t = threading.Thread(target=_start_server, daemon=True)
    t.start()
    time.sleep(0.5)          # let server bind

    stub = _client()
    stub.Enqueue(scheduler_pb2.EnqueueRequest(
        job=scheduler_pb2.Job(id="1", priority=1, payload="hello")
    ))
    resp = stub.Dequeue(scheduler_pb2.DequeueRequest())
    assert resp.job.payload == "hello"
