"""FastAPI entry point for the Crave culinary engine."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.auth import router as auth_router
from app.config import get_settings
from app.db import get_engine, initialize_database
from app.recipes import router as recipes_router

settings = get_settings()
PRODUCTION_FRONTEND_ORIGIN = "https://crave-frontend-production.up.railway.app"
PRODUCTION_BACKEND_HOST = "crave-backend-production.up.railway.app"
cors_origins = list(dict.fromkeys([PRODUCTION_FRONTEND_ORIGIN, *settings.cors_origin_list]))
trusted_hosts = list(dict.fromkeys([PRODUCTION_BACKEND_HOST, "healthcheck.railway.app", *settings.allowed_host_list]))


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Prepare Postgres schema and release the connection pool on shutdown."""
    if settings.database_url is None:
        if settings.is_production:
            raise RuntimeError("DATABASE_URL must be set in production")
    else:
        await initialize_database()
    yield
    if settings.database_url is not None:
        await get_engine().dispose()


app = FastAPI(
    title="Crave API",
    version="0.1.0",
    description="AI-powered recipe generation from ingredients, nutrition goals, and mood.",
    # Do not expose the API schema or interactive docs publicly in production.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # The deployed Railway frontend is always accepted, even when Railway
    # variables have not been configured. Local origins may be added in .env.
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)
app.add_middleware(
    TrustedHostMiddleware,
    # Keep the deployed Railway domain reachable even when the environment
    # variable has not yet been entered in the Railway dashboard.
    allowed_hosts=trusted_hosts,
)
app.include_router(auth_router)
app.include_router(recipes_router)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


class RecipeRequest(BaseModel):
    """The intent collected by the Crave mobile client."""

    ingredients: list[str] = Field(default_factory=list, max_length=50, examples=[["chicken", "rice", "broccoli"]])
    mood: str | None = Field(default=None, max_length=50, examples=["comforting"])
    target_protein_grams: int | None = Field(default=None, ge=0, le=300, examples=[40])


class RecipePreview(BaseModel):
    title: str
    cooking_time_minutes: int
    calories: int
    protein_grams: int


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "crave-api"}


@app.get("/health/db")
async def database_health() -> dict[str, str]:
    """Verify Postgres connectivity without leaking connection details."""
    try:
        async with get_engine().connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="database unavailable") from None
    return {"status": "ok"}


@app.post("/recipes/generate", response_model=RecipePreview)
async def generate_recipe(request: RecipeRequest) -> RecipePreview:
    """Return a placeholder recipe until Gemini generation is connected."""
    return RecipePreview(title="Golden chicken bowl" if request.ingredients else "Your next favorite bowl", cooking_time_minutes=18, calories=542, protein_grams=request.target_protein_grams or 46)