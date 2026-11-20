from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+psycopg://aqarflow:aqarflow_dev@127.0.0.1:5433/aqarflow?options=-csearch_path%3Dzayqora"
    session_cookie_name: str = "zayqora_session"
    session_days: int = 14
    cors_origins: str = "http://localhost:3000"
    login_max_attempts: int = 5
    login_window_seconds: int = 300
    public_rate_limit_max_requests: int = 60
    public_rate_limit_window_seconds: int = 60
    auth_rate_limit_max_requests: int = 10
    auth_rate_limit_window_seconds: int = 300
    payment_webhook_secret: str = "dev_webhook_secret_change_me"
    payment_webhook_tolerance_seconds: int = 300
    site_url: str = "http://localhost:3000"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str = "no-reply@zayqora.local"
    smtp_use_tls: bool = True

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
