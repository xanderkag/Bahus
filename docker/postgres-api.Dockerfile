FROM python:3.11-alpine

WORKDIR /app

COPY requirements-backend.txt /app/requirements-backend.txt
RUN pip install --no-cache-dir -r /app/requirements-backend.txt

COPY scripts/postgres_api.py /app/scripts/postgres_api.py

EXPOSE 8078

CMD ["python3", "/app/scripts/postgres_api.py", "--host", "0.0.0.0", "--port", "8078"]
