from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 7000
    database_url: str = "mysql+pymysql://root:password@localhost:3306/wallet_db"
    redis_url: str = "redis://localhost:6379"
    player_service_url: str = "http://player-service:5000"
    service_api_key: str = ""
    initial_balance: float = 1000.0  # starting chips for new players

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
