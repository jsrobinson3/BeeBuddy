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
    HUGGINGFACE = "huggingface"
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
    db_pool_size: int = 5
    db_max_overflow: int = 3

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
    apple_web_client_id: str | None = None
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

    # Tool-calling LLM — defaults to primary LLM when None
    llm_tool_provider: LLMProvider | None = None
    llm_tool_model: str | None = None
    llm_tool_base_url_override: str | None = None  # Any OpenAI-compatible endpoint
    llm_tool_api_key_override: str | None = None  # API key for the override URL

    # Ollama (local development)
    ollama_base_url: str = "http://localhost:11434"

    # OpenAI
    openai_api_key: str | None = None

    # Anthropic
    anthropic_api_key: str | None = None

    # Hugging Face Inference Endpoints
    hf_token: str | None = None
    hf_inference_endpoint_url: str | None = None  # e.g. https://<id>.endpoints.huggingface.cloud
    hf_warmup_cooldown_seconds: int = 300       # 5 min between warm-up attempts
    hf_warmup_keepalive_enabled: bool = False   # Celery Beat periodic ping
    hf_warmup_keepalive_interval: int = 240     # Seconds between keep-alive pings

    # Endpoint identity (for HF SDK status checks & CLI)
    hf_endpoint_namespace: str = "jsrobinson3"
    hf_endpoint_name: str = "beebuddy-bee-gguf-jjo"
    hf_wake_timeout_seconds: int = 360
    hf_poll_interval_seconds: int = 5

    # Cold-start fallback LLM (serves responses while HF endpoint wakes up)
    hf_fallback_provider: LLMProvider = LLMProvider.ANTHROPIC
    hf_fallback_model: str = "claude-haiku-4-5-20251001"

    # Agricultural data APIs
    usda_nass_api_key: str | None = None

    # Guardrails
    guardrails_enabled: bool = True
    guardrails_log_only: bool = True  # Log flags but never block/rewrite
    guardrails_style_enabled: bool = True
    guardrails_topic_enabled: bool = True
    guardrails_safety_enabled: bool = True
    guardrails_safety_append_disclaimer: bool = True
    guardrails_safety_block_high_severity: bool = False  # Log-only until calibrated
    guardrails_audit_db_enabled: bool = True  # Persist guard decisions to DB
    guardrails_audit_log_all: bool = False  # Only log failures by default
    guardrails_condense_enabled: bool = False  # Extra LLM call, off by default
    guardrails_max_words_yes_no: int = 30
    guardrails_max_words_how_to: int = 150
    guardrails_max_words_explain: int = 250

    # RAG Knowledge Base
    rag_enabled: bool = True
    rag_top_k: int = 5
    rag_similarity_threshold: float = 0.3
    embedding_model: str = "nomic-embed-text"
    embedding_dim: int = 768
    embedding_provider: str = "ollama"  # "ollama" or "huggingface"
    rag_seed_hf_dataset: str = "jsrobinson3/beebuddy-rag-seed"

    # Rate limiting
    rate_limit_enabled: bool = True

    # SSL certificates (optional — for managed DB/Redis with custom CA)
    redis_ca_cert: str | None = None
    database_ca_cert: str | None = None

    # Sentry
    sentry_dsn: str | None = None
    sentry_traces_sample_rate: float = 0.2
    sentry_environment: str = "development"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8081", "http://localhost:19006"]

    @property
    def effective_tool_provider(self) -> "LLMProvider":
        """Provider for tool-calling LLM (defaults to primary)."""
        return self.llm_tool_provider or self.llm_provider

    @property
    def effective_tool_model(self) -> str:
        """Model for tool-calling LLM (defaults to primary)."""
        return self.llm_tool_model or self.llm_model

    @property
    def llm_tool_base_url(self) -> str:
        """Base URL for the tool-calling LLM provider."""
        if self.llm_tool_base_url_override:
            return self.llm_tool_base_url_override.rstrip("/")
        provider = self.effective_tool_provider
        if provider == LLMProvider.OPENAI:
            return "https://api.openai.com/v1"
        if provider == LLMProvider.ANTHROPIC:
            return "https://api.anthropic.com/v1"
        if provider == LLMProvider.HUGGINGFACE:
            return f"{self.hf_inference_endpoint_url.rstrip('/')}/v1"
        return f"{self.ollama_base_url}/v1"

    @property
    def llm_tool_api_key(self) -> str | None:
        """API key for the tool-calling LLM provider."""
        if self.llm_tool_api_key_override:
            return self.llm_tool_api_key_override
        provider = self.effective_tool_provider
        if provider == LLMProvider.OPENAI:
            return self.openai_api_key
        if provider == LLMProvider.ANTHROPIC:
            return self.anthropic_api_key
        if provider == LLMProvider.HUGGINGFACE:
            return self.hf_token
        return "ollama"

    @property
    def llm_base_url(self) -> str:
        """Get the base URL for the configured LLM provider."""
        if self.llm_provider == LLMProvider.OPENAI:
            return "https://api.openai.com/v1"
        if self.llm_provider == LLMProvider.ANTHROPIC:
            return "https://api.anthropic.com/v1"
        if self.llm_provider == LLMProvider.HUGGINGFACE and not self.hf_inference_endpoint_url:
            raise ValueError(
                "HF_INFERENCE_ENDPOINT_URL required when LLM_PROVIDER=huggingface"
            )
        if self.llm_provider == LLMProvider.HUGGINGFACE:
            return f"{self.hf_inference_endpoint_url.rstrip('/')}/v1"
        return f"{self.ollama_base_url}/v1"

    @property
    def llm_api_key(self) -> str | None:
        """Get the API key for the configured LLM provider."""
        if self.llm_provider == LLMProvider.OPENAI:
            return self.openai_api_key
        if self.llm_provider == LLMProvider.ANTHROPIC:
            return self.anthropic_api_key
        if self.llm_provider == LLMProvider.HUGGINGFACE:
            return self.hf_token
        return "ollama"  # Ollama doesn't need a real key

    @property
    def hf_fallback_base_url(self) -> str:
        """Base URL for the cold-start fallback LLM provider."""
        p = self.hf_fallback_provider
        if p == LLMProvider.OPENAI:
            return "https://api.openai.com/v1"
        if p == LLMProvider.ANTHROPIC:
            return "https://api.anthropic.com/v1"
        if p == LLMProvider.HUGGINGFACE:
            return f"{self.hf_inference_endpoint_url.rstrip('/')}/v1"
        return f"{self.ollama_base_url}/v1"

    @property
    def hf_fallback_api_key(self) -> str | None:
        """API key for the cold-start fallback LLM provider."""
        p = self.hf_fallback_provider
        if p == LLMProvider.OPENAI:
            return self.openai_api_key
        if p == LLMProvider.ANTHROPIC:
            return self.anthropic_api_key
        if p == LLMProvider.HUGGINGFACE:
            return self.hf_token
        return "ollama"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
