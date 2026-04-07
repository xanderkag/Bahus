FROM python:3.11-alpine

WORKDIR /app

COPY scripts/mock_api.py /app/scripts/mock_api.py
COPY src/data/demo-data.js /app/src/data/demo-data.js
COPY src/data/demo-imports.json /app/src/data/demo-imports.json

EXPOSE 8079

CMD ["python3", "/app/scripts/mock_api.py", "--host", "0.0.0.0", "--port", "8079"]
