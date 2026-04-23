from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.wallet_models import (
    DepositRequest,
    WithdrawRequest,
    CreateWalletRequest,
    DebitRequest,
    CreditRequest,
)
from ..services import wallet_service
from ..services.player_cache import validate_player_critical

router = APIRouter()

# ── Internal (service-to-service) endpoints ──────────

def _verify_service_key(x_service_key: str = Header(..., alias="X-Service-Key")) -> None:
    from ..config import settings
    if x_service_key != settings.service_api_key:
        raise HTTPException(status_code=403, detail="Invalid service key")


@router.post("/internal/wallet/create", dependencies=[Depends(_verify_service_key)])
def create_wallet(body: CreateWalletRequest, db: Session = Depends(get_db)):
    existing = wallet_service.get_wallet(db, body.userId)
    if existing:
        return {"id": existing.id, "userId": existing.user_id, "balance": float(existing.balance)}
    wallet = wallet_service.create_wallet(db, body.userId)
    return {"id": wallet.id, "userId": wallet.user_id, "balance": float(wallet.balance)}


@router.get("/internal/balance/{user_id}", dependencies=[Depends(_verify_service_key)])
def get_balance_internal(user_id: str, db: Session = Depends(get_db)):
    wallet = wallet_service.get_or_create_wallet(db, user_id)
    return {"balance": float(wallet.balance)}


@router.post("/internal/debit", dependencies=[Depends(_verify_service_key)])
def debit_wallet(body: DebitRequest, db: Session = Depends(get_db)):
    try:
        wallet = wallet_service.debit(
            db,
            user_id=body.userId,
            amount=body.amount,
            description=body.description or "Bet",
            game_session_id=body.gameSessionId if hasattr(body, 'gameSessionId') else None,
        )
        return {"balance": float(wallet.balance)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/internal/credit", dependencies=[Depends(_verify_service_key)])
def credit_wallet(body: CreditRequest, db: Session = Depends(get_db)):
    try:
        wallet = wallet_service.credit(
            db,
            user_id=body.userId,
            amount=body.amount,
            description=body.description or "Win",
            game_session_id=body.gameSessionId if hasattr(body, 'gameSessionId') else None,
        )
        return {"balance": float(wallet.balance)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Public (user-facing via API Gateway) endpoints ───

@router.get("/wallet/balance")
def get_balance(
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    wallet = wallet_service.get_or_create_wallet(db, x_user_id)
    return {"balance": float(wallet.balance), "userId": wallet.user_id}


@router.post("/wallet/deposit")
def deposit(
    body: DepositRequest,
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    if body.amount <= 0 or body.amount > 10000:
        raise HTTPException(status_code=400, detail="Deposit must be between 1 and 10,000")

    # Critical validation before financial operation
    ok, msg = validate_player_critical(x_user_id)
    if not ok:
        raise HTTPException(status_code=403, detail=msg)

    wallet = wallet_service.deposit(db, x_user_id, body.amount)
    return {"balance": float(wallet.balance), "message": f"Deposited {body.amount:.2f}"}


@router.post("/wallet/withdraw")
def withdraw(
    body: WithdrawRequest,
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Withdrawal amount must be positive")

    ok, msg = validate_player_critical(x_user_id)
    if not ok:
        raise HTTPException(status_code=403, detail=msg)

    try:
        wallet = wallet_service.withdraw(db, x_user_id, body.amount)
        return {"balance": float(wallet.balance), "message": f"Withdrew {body.amount:.2f}"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/wallet/transactions")
def get_transactions(
    page: int = 1,
    limit: int = 20,
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
):
    limit = min(100, max(1, limit))
    page = max(1, page)
    txs, total = wallet_service.get_transactions(db, x_user_id, page, limit)

    return {
        "transactions": [
            {
                "id": t.id,
                "amount": float(t.amount),
                "type": t.type,
                "description": t.description,
                "gameSessionId": t.game_session_id,
                "createdAt": t.created_at.isoformat() if t.created_at else None,
            }
            for t in txs
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }
