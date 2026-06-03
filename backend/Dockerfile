FROM python:3.11-slim

# OCR (tesseract), Tika (Java), python-magic (libmagic) system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    default-jdk \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m spacy download en_core_web_sm

COPY . .

# Storage dir lives outside any web root; mounted as a volume in compose.
RUN mkdir -p /app/storage

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
