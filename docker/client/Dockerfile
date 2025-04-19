FROM python:3.9-slim

WORKDIR /app

# Install client dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy client code and example
COPY src/client/ /app/src/client/
COPY examples/client_quickstart.py /app/

ENV PYTHONPATH=/app/src

# Run the quickstart by default
CMD ["python", "client_quickstart.py"]
