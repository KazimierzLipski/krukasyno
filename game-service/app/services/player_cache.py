"""
Player cache for the Game Service.

Non-critical ops use the Redis cache.
Critical ops (bet placement) call Player Service directly.
"""
import json
import httpx
import redis.asyncio as aioredis

from ..config import settings

CACHE_TTL = 300  # 5 minutes

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def get_player_cached(user_id: str) -> dict | None:
    """Return cached player data (non-critical path)."""
    r = await get_redis()
    raw = await r.get(f"cache:player:{user_id}")
    if raw:
        return json.loads(raw)
    return await refresh_player_cache(user_id)


async def refresh_player_cache(user_id: str) -> dict | None:
    """Fetch from Player Service and cache."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.player_service_url}/users/{user_id}",
                headers={"X-Service-Key": settings.service_api_key},
            )
            if resp.status_code != 200:
                return None
            data = resp.json().get("user")
            if data:
                r = await get_redis()
                await r.set(f"cache:player:{user_id}", json.dumps(data), ex=CACHE_TTL)
            return data
    except Exception as exc:
        print(f"[player_cache] refresh failed: {exc}")
        return None


async def validate_player_critical(user_id: str) -> tuple[bool, str]:
    """Direct call to Player Service for critical operations."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.player_service_url}/users/{user_id}",
                headers={"X-Service-Key": settings.service_api_key},
            )
            if resp.status_code != 200:
                return False, "Player not found"
            player = resp.json().get("user", {})
            if player.get("isBanned"):
                return False, "Account is banned"
            return True, "ok"
    except Exception as exc:
        return False, f"Validation service unavailable: {exc}"
