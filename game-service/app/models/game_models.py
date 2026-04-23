from enum import Enum
from typing import Optional, List
from pydantic import BaseModel


class Suit(str, Enum):
    hearts = "hearts"
    diamonds = "diamonds"
    clubs = "clubs"
    spades = "spades"


class Card(BaseModel):
    suit: Suit
    rank: str   # "A","2"-"10","J","Q","K"
    hidden: bool = False


class BlackjackStatus(str, Enum):
    player_turn = "player_turn"
    dealer_turn = "dealer_turn"
    player_won = "player_won"
    dealer_won = "dealer_won"
    push = "push"
    blackjack = "blackjack"
    bust = "bust"


class BlackjackGame(BaseModel):
    game_id: str
    user_id: str
    bet: float
    player_hand: List[Card]
    dealer_hand: List[Card]
    player_score: int
    dealer_visible_score: int
    status: BlackjackStatus
    payout: float = 0.0


class BlackjackStartRequest(BaseModel):
    bet: float


class SlotSymbol(str, Enum):
    cherry = "🍒"
    lemon = "🍋"
    orange = "🍊"
    grapes = "🍇"
    star = "⭐"
    diamond = "💎"
    seven = "7️⃣"


class SlotsResult(BaseModel):
    reels: List[str]          # three symbols
    win: bool
    multiplier: float
    payout: float
    bet: float
    new_balance: float


class SlotsSpinRequest(BaseModel):
    bet: float
