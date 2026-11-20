FROM python:3.11-slim

WORKDIR /app

# Copy shared library first (available at /shared)
COPY shared/ /shared/

# Install dependencies
COPY services/notification-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service source
COPY services/notification-service/ .

# Ensure both /app and / are on the Python path so `import shared` works
ENV PYTHONPATH=/:/app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]
