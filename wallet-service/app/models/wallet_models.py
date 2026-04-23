from typing import Optional
from pydantic import BaseModel


class WalletResponse(BaseModel):
    id: str
    userId: str
    balance: float
    createdAt: str


class TransactionResponse(BaseModel):
    id: str
    walletId: str
    userId: str
    amount: float
    type: str
    description: Optional[str] = None
    gameSessionId: Optional[str] = None
    createdAt: str


class DepositRequest(BaseModel):
    amount: float


class WithdrawRequest(BaseModel):
    amount: float


class CreateWalletRequest(BaseModel):
    userId: str


class DebitRequest(BaseModel):
    userId: str
    amount: float
    description: Optional[str] = None
    gameSessionId: Optional[str] = None


class CreditRequest(BaseModel):
    userId: str
    amount: float
    description: Optional[str] = None
    gameSessionId: Optional[str] = None
