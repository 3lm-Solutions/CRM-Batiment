FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY api ./api
COPY catalog ./catalog
COPY devis ./devis
COPY toolregistry ./toolregistry
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
