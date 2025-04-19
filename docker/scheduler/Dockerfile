FROM python:3.9-slim

WORKDIR /app

# Install runtime dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server code
COPY src/server/ /app/server/
COPY src/core/ /app/core/
COPY src/scheduler_pb2*.py /app/

ENV PYTHONPATH=/app

# Expose gRPC port and metrics port
EXPOSE 50051 8000

# Start the server
CMD ["python", "-m", "server.app"]
