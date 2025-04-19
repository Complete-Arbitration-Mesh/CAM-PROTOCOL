"""
Round‑robin in‑memory Scheduler.
"""

from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, Any


@dataclass(order=True)
class _QueueItem:
    priority: int
    order: int
    job: Any = field(compare=False)


class Scheduler:
    """Simple round‑robin / priority hybrid scheduler."""

    def __init__(self) -> None:
        self._queues: Dict[int, Deque[_QueueItem]] = {}
        self._counter = 0  # FIFO tiebreaker

    # --------------------------- public API --------------------------- #
    def enqueue(self, job: Any, priority: int = 0) -> None:
        """Add a job to the queue."""
        if priority not in self._queues:
            self._queues[priority] = deque()
        self._queues[priority].append(_QueueItem(priority, self._counter, job))
        self._counter += 1

    def dequeue(self) -> Any:
        """Pop the next job. Raises IndexError if empty."""
        if not self:
            raise IndexError("Scheduler queue is empty")
        prio = min(self._queues)
        item = self._queues[prio].popleft()
        if not self._queues[prio]:
            del self._queues[prio]
        return item.job

    def reprioritise(self, job_id: Any, new_priority: int) -> None:
        """Change priority of the first job matching job_id."""
        for prio, q in list(self._queues.items()):
            for idx, itm in enumerate(q):
                if itm.job == job_id:
                    del q[idx]
                    if not q:
                        del self._queues[prio]
                    self.enqueue(job_id, new_priority)
                    return
        raise ValueError(f"Job {job_id!r} not found")

    # --------------------------- helpers ----------------------------- #
    def __len__(self) -> int:
        return sum(len(q) for q in self._queues.values())

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Scheduler size={len(self)} queues={list(self._queues)}>"
