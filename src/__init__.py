"""src package root."""
from importlib import import_module as _im

try:
    scheduler_pb2 = _im("src.scheduler_pb2")
    scheduler_pb2_grpc = _im("src.scheduler_pb2_grpc")
except ModuleNotFoundError:
    # stubs not generated yet
    pass

# --- make top‑level imports work for generated stubs ---
import importlib, sys
try:
    sys.modules.setdefault("scheduler_pb2", importlib.import_module("src.scheduler_pb2"))
except ModuleNotFoundError:
    pass
