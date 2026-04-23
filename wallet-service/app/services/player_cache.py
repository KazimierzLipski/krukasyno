"""
Player cache for the Wallet Service — mirrors game-service/app/services/player_cache.py.
"""
import json
import httpx
import redis

from ..config import settings

CACHE_TTL = 300

_redis_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


def get_player_cached(user_id: str) -> dict | None:
    r = get_redis()
    raw = r.get(f"cache:player:{user_id}")
    if raw:
        return json.loads(raw)
    return refresh_player_cache(user_id)


def refresh_player_cache(user_id: str) -> dict | None:
    try:
        resp = httpx.get(
            f"{settings.player_service_url}/users/{user_id}",
            headers={"X-Service-Key": settings.service_api_key},
            timeout=5.0,
        )
        if resp.status_code != 200:
            return None
        data = resp.json().get("user")
        if data:
            r = get_redis()
            r.set(f"cache:player:{user_id}", json.dumps(data), ex=CACHE_TTL)
        return data
    except Exception as exc:
        print(f"[wallet player_cache] refresh failed: {exc}")
        return None


def validate_player_critical(user_id: str) -> tuple[bool, str]:
    """Direct (non-cached) call for critical operations."""
    try:
        resp = httpx.get(
            f"{settings.player_service_url}/users/{user_id}",
            headers={"X-Service-Key": settings.service_api_key},
            timeout=5.0,
        )
        if resp.status_code != 200:
            return False, "Player not found"
        player = resp.json().get("user", {})
        if player.get("isBanned"):
            return False, "Account is banned"
        return True, "ok"
    except Exception as exc:
        return False, f"Validation service unavailable: {exc}"
