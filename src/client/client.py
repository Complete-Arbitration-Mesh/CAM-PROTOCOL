import grpc
from src import scheduler_pb2, scheduler_pb2_grpc

class Client:
    def __init__(self, host: str = 'localhost', port: int = 50051):
        channel = grpc.insecure_channel(f'{host}:{port}')
        self._stub = scheduler_pb2_grpc.SchedulerStub(channel)

    def enqueue(self, job: str, priority: int = 0) -> None:
        req = scheduler_pb2.EnqueueRequest(
            job=scheduler_pb2.Job(id="", priority=priority, payload=job)
        )
        self._stub.Enqueue(req)

    def dequeue(self) -> str:
        resp = self._stub.Dequeue(scheduler_pb2.DequeueRequest())
        return resp.job.payload

    def reprioritise(self, job_id: str, new_priority: int) -> None:
        req = scheduler_pb2.ReprioritiseRequest(id=job_id, newPriority=new_priority)
        self._stub.Reprioritise(req)
