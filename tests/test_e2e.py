import subprocess
import sys
import time
import pytest

@pytest.mark.timeout(30)
def test_end_to_end(tmp_path):
    # Start the gRPC server
    server = subprocess.Popen(
        [sys.executable, "-m", "src.server.app"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    # Give it a moment to start
    time.sleep(1)

    try:
        # Run the client quickstart
        proc = subprocess.run(
            [sys.executable, "examples/client_quickstart.py"],
            capture_output=True, text=True, timeout=10
        )
        output = proc.stdout + proc.stderr

        # Assert expected output
        assert "Enqueuing jobs..." in output
        assert "Dequeued:" in output
    finally:
        server.terminate()
        server.wait()
