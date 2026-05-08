import pytest
import httpx
from app.main import app
from fastapi.testclient import TestClient
from app.database import Base, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


# ─────────────────────────────
# DB (bez zmian)
# ─────────────────────────────

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


# ─────────────────────────────
# FIX: MOCK httpx.get (KLUCZ)
# ─────────────────────────────

@pytest.fixture()
def client(monkeypatch):
    def mock_get(url, *args, **kwargs):

        # player-service mock
        if "user-1" in url or "user-2" in url:
            return httpx.Response(
                200,
                json={"user": {"id": "user-1", "isBanned": False}},
            )

        if "banned" in url:
            return httpx.Response(
                200,
                json={"user": {"id": "banned", "isBanned": True}},
            )

        return httpx.Response(404, json={"error": "not mocked"})

    monkeypatch.setattr(httpx, "get", mock_get)

    return TestClient(app)