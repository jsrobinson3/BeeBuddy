"""Application configuration using Pydantic Settings."""

from enum import StrEnum
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class LLMProvider(StrEnum):
    """Supported LLM providers."""
    OLLAMA = "ollama"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    BEDROCK = "bedrock"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "BeeBuddy API"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/beebuddy"

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        """Ensure async driver prefix and strip sslmode for asyncpg."""
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        # asyncpg doesn't accept sslmode — we handle SSL via connect_args
        v = v.replace("?sslmode=require", "").replace("&sslmode=require", "")
        return v

    @property
    def database_requires_ssl(self) -> bool:
        """True when the raw DATABASE_URL requested SSL."""
        import os
        raw = os.environ.get("DATABASE_URL", "")
        return "sslmode=require" in raw

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # S3-compatible storage (MinIO for local dev)
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    s3_bucket: str = "beebuddy-photos"
    s3_endpoint_url: str | None = None  # MinIO in dev, S3/Spaces/B2 in prod
    s3_region: str = "atl1"  # DO Spaces region
    s3_public_url: str | None = None  # Client-reachable S3 URL for presigned URLs
    presigned_url_ttl_seconds: int = 300  # 5-minute default

    # Auth (JWT)
    secret_key: str  # Required — must be set via env var or .env file
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # Auth cookies (HttpOnly, for web clients)
    cookie_domain: str | None = None
    cookie_secure: bool = True

    @field_validator("secret_key")
    @classmethod
    def secret_key_must_not_be_weak(cls, v: str) -> str:
        """Reject known-bad secret key values."""
        bad_values = {"change-me-in-production", "secret", "changeme", ""}
        if v.strip().lower() in bad_values:
            raise ValueError("secret_key must be set to a strong, unique value")
        return v

    cookie_samesite: str = "lax"
    cookie_path: str = "/api"

    # OAuth2 Social Login
    google_client_id: str | None = None
    google_client_secret: str | None = None
    apple_client_id: str | None = None
    apple_team_id: str | None = None
    apple_key_id: str | None = None
    apple_private_key: str | None = None
    microsoft_client_id: str | None = None
    microsoft_client_secret: str | None = None

    # Email
    email_from_address: str = "noreply@beebuddy.app"
    email_from_name: str = "BeeBuddy"
    email_suppress: bool = False  # True in dev — logs email instead of sending
    sendgrid_api_key: str | None = None

    # Frontend URL (for email links)
    frontend_url: str = "http://localhost:8081"

    # LLM Configuration
    llm_provider: LLMProvider = LLMProvider.OLLAMA
    llm_model: str = "llama3.2:3b"

    # Ollama (local development)
    ollama_base_url: str = "http://localhost:11434"

    # OpenAI
    openai_api_key: str | None = None

    # Anthropic
    anthropic_api_key: str | None = None

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8081", "http://localhost:19006"]

    @property
    def llm_base_url(self) -> str:
        """Get the base URL for the configured LLM provider."""
        if self.llm_provider == LLMProvider.OLLAMA:
            return f"{self.ollama_base_url}/v1"
        elif self.llm_provider == LLMProvider.OPENAI:
            return "https://api.openai.com/v1"
        elif self.llm_provider == LLMProvider.ANTHROPIC:
            return "https://api.anthropic.com/v1"
        else:
            return self.ollama_base_url

    @property
    def llm_api_key(self) -> str | None:
        """Get the API key for the configured LLM provider."""
        if self.llm_provider == LLMProvider.OPENAI:
            return self.openai_api_key
        elif self.llm_provider == LLMProvider.ANTHROPIC:
            return self.anthropic_api_key
        else:
            return "ollama"  # Ollama doesn't need a real key


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
