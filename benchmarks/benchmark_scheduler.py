import pytest
from src.core.scheduler import Scheduler

@pytest.mark.benchmark(group="scheduler")
def test_enqueue_dequeue(benchmark):
    def work():
        sched = Scheduler()
        for i in range(10000):
            sched.enqueue(f"job{i}", priority=i % 5)
        for i in range(10000):
            sched.dequeue()

    benchmark(work)
