"""Central application settings, loaded from environment / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=True)

    # ── Database / cache ──────────────────────────────────────────
    MONGODB_URI: str = "mongodb://mongo:27017/docuguard"
    MONGODB_DB_NAME: str = "docuguard"
    REDIS_URL: str = "redis://redis:6379/0"

    # ── AWS (Textract + Bedrock) ──────────────────────────────────
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    BEDROCK_MODEL_ID: str = "anthropic.claude-3-5-sonnet-20241022-v2:0"
    BEDROCK_REGION: str = "us-east-1"

    # ── Local filesystem storage (NO S3) ──────────────────────────
    LOCAL_STORAGE_DIR: str = "./storage"
    MAX_UPLOAD_BYTES: int = 50 * 1024 * 1024  # 50 MB per file
    MAX_BATCH_FILES: int = 10

    # ── JWT ───────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "change_me_minimum_32_character_secret_key_value"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Field encryption (AES-256 Fernet) ─────────────────────────
    FIELD_ENCRYPTION_KEY: str = ""

    # ── App ───────────────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def cookie_secure(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()
