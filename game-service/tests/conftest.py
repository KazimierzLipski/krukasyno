import pytest
import pytest_asyncio
import fakeredis.aioredis as fakeredis

from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport

from app.main import app
import app.services.blackjack_service as bj_svc
import app.services.player_cache as pc_svc


@pytest_asyncio.fixture(autouse=True)
async def fake_redis_patch():
    """Replace every aioredis.from_url call with fakeredis."""
    fake = fakeredis.FakeRedis(decode_responses=True)

    async def _fake_from_url(*args, **kwargs):
        return fake

    with patch("app.services.blackjack_service.aioredis.from_url", _fake_from_url), \
         patch("app.services.player_cache.aioredis.from_url", _fake_from_url):
        # Reset module-level singletons so they pick up the fake
        bj_svc._redis = None
        pc_svc._redis = None
        yield fake
        bj_svc._redis = None
        pc_svc._redis = None


@pytest.fixture
def player_ok():
    """Patch validate_player_critical to always pass."""
    with patch(
        "app.routers.blackjack.validate_player_critical",
        new_callable=AsyncMock,
        return_value=(True, "ok"),
    ), patch(
        "app.routers.slots.validate_player_critical",
        new_callable=AsyncMock,
        return_value=(True, "ok"),
    ):
        yield


@pytest.fixture
def wallet_ok():
    """Patch wallet HTTP calls to succeed with balance=1000."""
    debit_mock = AsyncMock(return_value=900.0)
    credit_mock = AsyncMock(return_value=1000.0)
    with patch("app.routers.blackjack._debit", debit_mock), \
         patch("app.routers.blackjack._credit", credit_mock), \
         patch("app.routers.slots._debit", debit_mock), \
         patch("app.routers.slots._credit", credit_mock):
        yield debit_mock, credit_mock


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


USER_HEADERS = {"X-User-Id": "user-123"}
