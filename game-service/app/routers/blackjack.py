from fastapi import APIRouter, Header, HTTPException
import httpx

from ..config import settings
from ..models.game_models import BlackjackStartRequest, BlackjackGame
from ..services import blackjack_service
from ..services.player_cache import validate_player_critical

router = APIRouter(prefix="/blackjack", tags=["blackjack"])


async def _debit(user_id: str, amount: float, session_id: str) -> float:
    """Debit bet from wallet and return new balance."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{settings.wallet_service_url}/internal/debit",
            json={"userId": user_id, "amount": amount, "gameSessionId": session_id,
                  "description": f"Blackjack bet"},
            headers={"X-Service-Key": settings.service_api_key},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=resp.json().get("detail", "Insufficient funds"))
        return resp.json()["balance"]


async def _credit(user_id: str, amount: float, session_id: str, description: str) -> float:
    """Credit winnings to wallet."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{settings.wallet_service_url}/internal/credit",
            json={"userId": user_id, "amount": amount, "gameSessionId": session_id,
                  "description": description},
            headers={"X-Service-Key": settings.service_api_key},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to credit wallet")
        return resp.json()["balance"]


def _is_terminal(game: BlackjackGame) -> bool:
    return game.status not in ("player_turn",)


@router.post("/start")
async def start_blackjack(
    body: BlackjackStartRequest,
    x_user_id: str = Header(..., alias="X-User-Id"),
):
    if body.bet <= 0:
        raise HTTPException(status_code=400, detail="Bet must be positive")

    # Critical validation
    ok, msg = await validate_player_critical(x_user_id)
    if not ok:
        raise HTTPException(status_code=403, detail=msg)

    # Check no active game
    existing = await blackjack_service.get_game(x_user_id)
    if existing and existing.status == "player_turn":
        raise HTTPException(status_code=409, detail="Active game in progress")

    # Debit bet
    await _debit(x_user_id, body.bet, "pending")

    game = await blackjack_service.start_game(x_user_id, body.bet)

    # If immediate terminal (natural blackjack / push) pay out now
    if _is_terminal(game) and game.payout > 0:
        await _credit(x_user_id, game.payout, game.game_id,
                      "Blackjack payout" if game.status == "blackjack" else "Push refund")

    return game


@router.get("/state")
async def get_state(x_user_id: str = Header(..., alias="X-User-Id")):
    game = await blackjack_service.get_game(x_user_id)
    if not game:
        raise HTTPException(status_code=404, detail="No active game")
    return game


@router.post("/hit")
async def player_hit(x_user_id: str = Header(..., alias="X-User-Id")):
    game = await blackjack_service.hit(x_user_id)
    if not game:
        raise HTTPException(status_code=404, detail="No active game")
    # If bust, no payout (already debited)
    return game


@router.post("/stand")
async def player_stand(x_user_id: str = Header(..., alias="X-User-Id")):
    game = await blackjack_service.stand(x_user_id)
    if not game:
        raise HTTPException(status_code=404, detail="No active game")

    if game.payout > 0:
        desc = "Blackjack win" if game.status == "player_won" else "Push refund"
        await _credit(x_user_id, game.payout, game.game_id, desc)

    return game


@router.post("/double")
async def player_double(x_user_id: str = Header(..., alias="X-User-Id")):
    existing = await blackjack_service.get_game(x_user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="No active game")
    if len(existing.player_hand) != 2:
        raise HTTPException(status_code=400, detail="Can only double on initial two cards")

    # Debit extra bet (same as original)
    await _debit(x_user_id, existing.bet, existing.game_id)

    game = await blackjack_service.double_down(x_user_id)
    if not game:
        raise HTTPException(status_code=404, detail="No active game")

    if game.payout > 0:
        desc = "Blackjack double win" if game.status == "player_won" else "Double push refund"
        await _credit(x_user_id, game.payout, game.game_id, desc)

    return game
