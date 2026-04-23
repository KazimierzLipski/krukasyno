from fastapi import APIRouter, Header, HTTPException
import httpx

from ..config import settings
from ..models.game_models import SlotsSpinRequest, SlotsResult
from ..services.slots_service import spin_slots
from ..services.player_cache import validate_player_critical

router = APIRouter(prefix="/slots", tags=["slots"])

MIN_BET = 1.0
MAX_BET = 500.0


async def _get_balance(user_id: str) -> float:
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(
            f"{settings.wallet_service_url}/internal/balance/{user_id}",
            headers={"X-Service-Key": settings.service_api_key},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Could not fetch balance")
        return float(resp.json()["balance"])


async def _debit(user_id: str, amount: float) -> float:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{settings.wallet_service_url}/internal/debit",
            json={"userId": user_id, "amount": amount, "description": "Slots spin"},
            headers={"X-Service-Key": settings.service_api_key},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=resp.json().get("detail", "Insufficient funds"))
        return float(resp.json()["balance"])


async def _credit(user_id: str, amount: float, description: str) -> float:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{settings.wallet_service_url}/internal/credit",
            json={"userId": user_id, "amount": amount, "description": description},
            headers={"X-Service-Key": settings.service_api_key},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to credit wallet")
        return float(resp.json()["balance"])


@router.post("/spin")
async def spin(
    body: SlotsSpinRequest,
    x_user_id: str = Header(..., alias="X-User-Id"),
):
    if body.bet < MIN_BET or body.bet > MAX_BET:
        raise HTTPException(
            status_code=400,
            detail=f"Bet must be between {MIN_BET} and {MAX_BET}",
        )

    # Critical player validation
    ok, msg = await validate_player_critical(x_user_id)
    if not ok:
        raise HTTPException(status_code=403, detail=msg)

    # Debit bet first
    balance_after_bet = await _debit(x_user_id, body.bet)

    # Compute result
    result = spin_slots(body.bet, balance_after_bet + body.bet)  # pass pre-bet balance

    # Credit winnings if any
    final_balance = balance_after_bet
    if result.payout > 0:
        final_balance = await _credit(x_user_id, result.payout, f"Slots win {result.multiplier}x")

    result.new_balance = final_balance
    return result
