import pytest
from unittest.mock import patch
from app.services.slots_service import spin_slots


def _force_reels(symbols: list[str]):
    """Context manager that forces random.choices to return given symbols."""
    return patch("app.services.slots_service.random.choices", return_value=symbols)


class TestSpinSlots:
    def test_three_of_a_kind_cherry(self):
        with _force_reels(["🍒", "🍒", "🍒"]):
            result = spin_slots(bet=10.0, current_balance=1000.0)
        assert result.win is True
        assert result.multiplier == 2.0
        assert result.payout == 20.0

    def test_three_of_a_kind_seven(self):
        with _force_reels(["7️⃣", "7️⃣", "7️⃣"]):
            result = spin_slots(bet=10.0, current_balance=1000.0)
        assert result.multiplier == 50.0
        assert result.payout == 500.0

    def test_two_cherries_partial_win(self):
        with _force_reels(["🍒", "🍒", "🍋"]):
            result = spin_slots(bet=10.0, current_balance=1000.0)
        assert result.win is True
        assert result.multiplier == 1.5
        assert result.payout == 15.0

    def test_no_win(self):
        with _force_reels(["🍒", "🍋", "🍊"]):
            result = spin_slots(bet=10.0, current_balance=1000.0)
        assert result.win is False
        assert result.multiplier == 0.0
        assert result.payout == 0.0

    def test_cherry_first_only_no_win(self):
        """One cherry at reel 0 but not reel 1 — no win."""
        with _force_reels(["🍒", "🍋", "🍒"]):
            result = spin_slots(bet=10.0, current_balance=1000.0)
        assert result.win is False

    def test_new_balance_win(self):
        with _force_reels(["💎", "💎", "💎"]):
            result = spin_slots(bet=50.0, current_balance=500.0)
        # payout = 50 * 20 = 1000; new_balance = 500 - 50 + 1000 = 1450
        assert result.new_balance == pytest.approx(1450.0)

    def test_new_balance_loss(self):
        with _force_reels(["🍒", "🍋", "🍊"]):
            result = spin_slots(bet=50.0, current_balance=500.0)
        assert result.new_balance == pytest.approx(450.0)

    def test_reels_returned(self):
        symbols = ["⭐", "⭐", "⭐"]
        with _force_reels(symbols):
            result = spin_slots(bet=1.0, current_balance=100.0)
        assert result.reels == symbols

    def test_bet_stored(self):
        with _force_reels(["🍋", "🍊", "🍇"]):
            result = spin_slots(bet=42.0, current_balance=100.0)
        assert result.bet == 42.0
