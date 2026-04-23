import random
from ..models.game_models import SlotsResult

# Symbol weights: higher weight = more frequent
SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "⭐", "💎", "7️⃣"]
WEIGHTS = [30, 25, 20, 15, 5, 3, 2]

# Payout multipliers for 3-of-a-kind
PAYOUTS = {
    "🍒": 2.0,
    "🍋": 3.0,
    "🍊": 4.0,
    "🍇": 5.0,
    "⭐": 10.0,
    "💎": 20.0,
    "7️⃣": 50.0,
}

# Two cherries + anything = 1.5×
CHERRY_TWO_MULTIPLIER = 1.5


def spin_slots(bet: float, current_balance: float) -> SlotsResult:
    reels = random.choices(SYMBOLS, weights=WEIGHTS, k=3)

    multiplier = 0.0
    if reels[0] == reels[1] == reels[2]:
        multiplier = PAYOUTS[reels[0]]
    elif reels[0] == "🍒" and reels[1] == "🍒":
        multiplier = CHERRY_TWO_MULTIPLIER

    payout = bet * multiplier
    new_balance = current_balance - bet + payout

    return SlotsResult(
        reels=reels,
        win=multiplier > 0,
        multiplier=multiplier,
        payout=payout,
        bet=bet,
        new_balance=new_balance,
    )
