"""Environment-driven settings. Secrets come from Railway variables, never from code."""

from functools import lru_cache

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    database_url: SecretStr | None = Field(default=None, alias="DATABASE_URL")
    gemini_api_key: SecretStr | None = Field(default=None, alias="GEMINI_API_KEY")
    openai_api_key: SecretStr | None = Field(default=None, alias="OPENAI_API_KEY")
    jwt_secret: SecretStr | None = Field(default=None, alias="JWT_SECRET")
    # Comma-separated list of exact origins, e.g. https://crave.up.railway.app
    cors_origins: str = "http://localhost:3000"
    # Comma-separated list of accepted Host headers; "*" only for local development.
    allowed_hosts: str = "localhost,127.0.0.1"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def jwt_secret_value(self) -> str:
        if self.jwt_secret is None:
            raise RuntimeError("JWT_SECRET is not set")
        return self.jwt_secret.get_secret_value()

    @property
    def openai_api_key_value(self) -> str:
        if self.openai_api_key is None:
            raise RuntimeError("OPENAI_API_KEY is not set")
        return self.openai_api_key.get_secret_value()

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_host_list(self) -> list[str]:
        hosts = [h.strip() for h in self.allowed_hosts.split(",") if h.strip()]
        # Railway's healthcheck probes with this Host header.
        return hosts + ["healthcheck.railway.app"]

    @property
    def sqlalchemy_database_url(self) -> str | None:
        """Normalize Railway's postgres:// / postgresql:// URL for SQLAlchemy + asyncpg."""
        if self.database_url is None:
            return None
        url = self.database_url.get_secret_value()
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+asyncpg://" + url[len(prefix):]
        return url

    @field_validator("cors_origins")
    @classmethod
    def _no_wildcard_origin(cls, value: str) -> str:
        if "*" in value:
            raise ValueError("CORS_ORIGINS must list explicit origins, not '*'")
        return value

    @model_validator(mode="after")
    def _production_secrets_are_present(self):
        if self.is_production and self.jwt_secret is None:
            raise ValueError("JWT_SECRET must be set in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
