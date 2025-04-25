import logging, os, sys
from pathlib import Path

# 1) Prepend repo root so "import src.*" works everywhere
ROOT = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(ROOT))
os.environ.setdefault("PYTHONPATH", str(ROOT))

# 2) Silence DEBUG/INFO flood in the bulk_enqueue_dequeue test
def pytest_runtest_setup(item):
    if "bulk_enqueue_dequeue" in item.name:
        logging.getLogger().setLevel(logging.WARNING)
