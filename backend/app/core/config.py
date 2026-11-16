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

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
