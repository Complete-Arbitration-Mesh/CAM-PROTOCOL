import pytest
from src.core.scheduler import Scheduler


def test_empty_dequeue_raises():
    sched = Scheduler()
    with pytest.raises(IndexError):
        sched.dequeue()


def test_priority_and_fifo():
    sched = Scheduler()
    sched.enqueue("low1", priority=5)
    sched.enqueue("high1", priority=1)
    sched.enqueue("high2", priority=1)
    sched.enqueue("low2", priority=5)

    assert sched.dequeue() == "high1"
    assert sched.dequeue() == "high2"
    assert sched.dequeue() == "low1"
    assert sched.dequeue() == "low2"
    assert len(sched) == 0


def test_reprioritise_changes_order():
    sched = Scheduler()
    sched.enqueue("job1", priority=3)
    sched.enqueue("job2", priority=3)
    sched.reprioritise("job2", new_priority=1)

    assert sched.dequeue() == "job2"
    assert sched.dequeue() == "job1"


def test_bulk_enqueue_dequeue():
    sched = Scheduler()
    for i in range(100):
        sched.enqueue(f"job{i}", priority=i % 3)

    results = [sched.dequeue() for _ in range(100)]
    assert len(set(results)) == 100
    assert len(sched) == 0
