#!/usr/bin/env python3
"""
gRPC server wrapping the Scheduler, with Prometheus metrics endpoint.
"""

import time
import structlog
import grpc
from concurrent import futures
from prometheus_client import start_http_server
from src.core.scheduler import Scheduler
from src.grpc import scheduler_pb2, scheduler_pb2_grpc

log = structlog.get_logger()


class SchedulerServicer(scheduler_pb2_grpc.SchedulerServicer):
    def __init__(self):
        self._sched = Scheduler()

    def Enqueue(self, request, context):
        job = request.job
        self._sched.enqueue(job.payload, job.priority)
        return scheduler_pb2.EnqueueReply()

    def Dequeue(self, request, context):
        try:
            payload = self._sched.dequeue()
            return scheduler_pb2.DequeueReply(
                job=scheduler_pb2.Job(id="", priority=0, payload=payload)
            )
        except IndexError:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details("queue empty")
            return scheduler_pb2.DequeueReply()

    def Reprioritise(self, request, context):
        try:
            self._sched.reprioritise(request.id, request.newPriority)
            return scheduler_pb2.ReprioritiseReply()
        except ValueError as e:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(str(e))
            return scheduler_pb2.ReprioritiseReply()


def serve(port: int = 50051):
    # Start Prometheus metrics HTTP server on port 8000
    start_http_server(8000)
    log.info("metrics HTTP server started", port=8000)

    # Start gRPC server
    server = grpc.server(futures.ThreadPoolExecutor())
    scheduler_pb2_grpc.add_SchedulerServicer_to_server(SchedulerServicer(), server)
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    log.info("gRPC server started", port=port)
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
