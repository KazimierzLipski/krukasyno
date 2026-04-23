import time
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Column, String, Numeric, Enum, DateTime, ForeignKey, create_engine
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from .config import settings

Base = declarative_base()


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), unique=True, nullable=False)
    balance = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    wallet_id = Column(String(36), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), nullable=False, index=True)
    amount = Column(Numeric(15, 2), nullable=False)
    type = Column(
        Enum("deposit", "withdrawal", "bet", "win", "refund", name="transaction_type"),
        nullable=False,
    )
    description = Column(String(500))
    game_session_id = Column(String(36))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


# ── Engine & Session ──────────────────────────────────

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    retries = 10
    for attempt in range(retries):
        try:
            Base.metadata.create_all(bind=engine)
            return
        except Exception as e:
            if attempt < retries - 1:
                print(f"[wallet-service] DB not ready, retrying in 5s... ({attempt + 1}/{retries})")
                time.sleep(5)
            else:
                raise e
