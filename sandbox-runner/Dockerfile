FROM python:3.11-slim

RUN useradd -m -u 10001 -s /bin/bash sandboxuser

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .
RUN chown -R sandboxuser:sandboxuser /app

USER sandboxuser
EXPOSE 8080

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}"]
