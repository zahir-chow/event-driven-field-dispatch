import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.database import engine, Base
from app.router import router as provider_router
from shared.middleware import configure_json_logging, add_correlation_middleware
from shared.health import make_health_router

SERVICE_NAME = os.environ.get("SERVICE_NAME", "provider-service")
KAFKA_BOOTSTRAP = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")

configure_json_logging(SERVICE_NAME)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        import logging
        logging.getLogger("dizpatch").warning(f"DB table creation failed on startup: {e}")
    yield


app = FastAPI(
    title="DiZpatch - Provider Service",
    description="Manages field technicians, skills, zip code coverage, ratings, and availability",
    version="1.0.0",
    lifespan=lifespan,
)

add_correlation_middleware(app, service_name=SERVICE_NAME)

app.include_router(provider_router)
app.include_router(make_health_router(engine, KAFKA_BOOTSTRAP, SERVICE_NAME))


@app.get("/")
def root():
    return {"service": SERVICE_NAME, "status": "running"}
