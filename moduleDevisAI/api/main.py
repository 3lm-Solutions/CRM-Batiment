from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

from toolregistry import configure_logging

from .routes import router

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
configure_logging()

app = FastAPI(title="Module Devis IA", version="2.0")
app.include_router(router)
