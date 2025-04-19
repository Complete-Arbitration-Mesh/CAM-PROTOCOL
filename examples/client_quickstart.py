#!/usr/bin/env python3
"""
Quickstart for CAM Scheduler client.
"""
from src.client.client import Client

def main():
    c = Client(host='localhost', port=50051)
    print("Enqueuing jobs...")
    c.enqueue("task-A", priority=10)
    c.enqueue("task-B", priority=1)
    print("Dequeued:", c.dequeue())
    print("Re‑enqueue and reprioritise")
    c.enqueue("task-C", priority=5)
    c.reprioritise("task-C", new_priority=0)
    print("Dequeued:", c.dequeue())

if __name__ == "__main__":
    main()
