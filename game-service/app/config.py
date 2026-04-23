from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 6100
    redis_url: str = "redis://localhost:6379"
    player_service_url: str = "http://player-service:5000"
    wallet_service_url: str = "http://wallet-service:7000"
    service_api_key: str = ""
    game_session_ttl: int = 3600  # seconds

    class Config:
        env_file = ".env"


settings = Settings()
