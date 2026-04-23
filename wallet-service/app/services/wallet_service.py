"""
Wallet business logic.
"""
import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from ..database import Wallet, Transaction
from ..config import settings


def get_wallet(db: Session, user_id: str) -> Optional[Wallet]:
    return db.query(Wallet).filter(Wallet.user_id == user_id).first()


def create_wallet(db: Session, user_id: str) -> Wallet:
    wallet = Wallet(
        id=str(uuid.uuid4()),
        user_id=user_id,
        balance=Decimal(str(settings.initial_balance)),
    )
    db.add(wallet)
    db.commit()
    db.refresh(wallet)
    return wallet


def get_or_create_wallet(db: Session, user_id: str) -> Wallet:
    wallet = get_wallet(db, user_id)
    if not wallet:
        wallet = create_wallet(db, user_id)
    return wallet


def deposit(
    db: Session,
    user_id: str,
    amount: float,
    description: str = "Deposit",
) -> Wallet:
    if amount <= 0:
        raise ValueError("Deposit amount must be positive")

    wallet = get_or_create_wallet(db, user_id)
    wallet.balance = Decimal(str(wallet.balance)) + Decimal(str(amount))

    tx = Transaction(
        id=str(uuid.uuid4()),
        wallet_id=wallet.id,
        user_id=user_id,
        amount=Decimal(str(amount)),
        type="deposit",
        description=description,
    )
    db.add(tx)
    db.commit()
    db.refresh(wallet)
    return wallet


def withdraw(
    db: Session,
    user_id: str,
    amount: float,
    description: str = "Withdrawal",
) -> Wallet:
    if amount <= 0:
        raise ValueError("Withdrawal amount must be positive")

    wallet = get_or_create_wallet(db, user_id)
    if Decimal(str(wallet.balance)) < Decimal(str(amount)):
        raise ValueError("Insufficient funds")

    wallet.balance = Decimal(str(wallet.balance)) - Decimal(str(amount))

    tx = Transaction(
        id=str(uuid.uuid4()),
        wallet_id=wallet.id,
        user_id=user_id,
        amount=Decimal(str(amount)),
        type="withdrawal",
        description=description,
    )
    db.add(tx)
    db.commit()
    db.refresh(wallet)
    return wallet


def debit(
    db: Session,
    user_id: str,
    amount: float,
    description: str = "Bet",
    game_session_id: Optional[str] = None,
) -> Wallet:
    """Debit wallet for a game bet."""
    if amount <= 0:
        raise ValueError("Amount must be positive")

    wallet = get_or_create_wallet(db, user_id)
    if Decimal(str(wallet.balance)) < Decimal(str(amount)):
        raise ValueError("Insufficient funds")

    wallet.balance = Decimal(str(wallet.balance)) - Decimal(str(amount))

    tx = Transaction(
        id=str(uuid.uuid4()),
        wallet_id=wallet.id,
        user_id=user_id,
        amount=Decimal(str(amount)),
        type="bet",
        description=description,
        game_session_id=game_session_id,
    )
    db.add(tx)
    db.commit()
    db.refresh(wallet)
    return wallet


def credit(
    db: Session,
    user_id: str,
    amount: float,
    description: str = "Win",
    game_session_id: Optional[str] = None,
) -> Wallet:
    """Credit wallet for a game win or push."""
    if amount <= 0:
        raise ValueError("Amount must be positive")

    wallet = get_or_create_wallet(db, user_id)
    wallet.balance = Decimal(str(wallet.balance)) + Decimal(str(amount))

    tx_type = "refund" if "refund" in description.lower() or "push" in description.lower() else "win"
    tx = Transaction(
        id=str(uuid.uuid4()),
        wallet_id=wallet.id,
        user_id=user_id,
        amount=Decimal(str(amount)),
        type=tx_type,
        description=description,
        game_session_id=game_session_id,
    )
    db.add(tx)
    db.commit()
    db.refresh(wallet)
    return wallet


def get_transactions(
    db: Session,
    user_id: str,
    page: int = 1,
    limit: int = 20,
):
    skip = (page - 1) * limit
    total = db.query(Transaction).filter(Transaction.user_id == user_id).count()
    txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return txs, total
