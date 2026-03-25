from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/agentgate"
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_JWT_SECRET: str = "placeholder-secret"
    JWT_SECRET: str = "placeholder-secret"
    JWT_ALGORITHM: str = "HS256"
    APPROVAL_TOKEN_TTL_SECONDS: int = 3600
    RATE_LIMIT_REQUESTS: int = 10
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    RESEND_API_KEY: str = ""
    DASHBOARD_URL: str = "https://app.agentgate.dev"
    ENVIRONMENT: str = "development"


settings = Settings()
