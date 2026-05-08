import pytest
from unittest.mock import AsyncMock, patch

from app.models.game_models import SlotsResult


def _make_result(win=False, payout=0.0, multiplier=0.0):
    return SlotsResult(
        reels=["🍒", "🍋", "🍊"],
        win=win,
        multiplier=multiplier,
        payout=payout,
        bet=10.0,
        new_balance=990.0,
    )


@pytest.mark.asyncio
class TestSlotsEndpoint:
    async def test_spin_success_no_win(self, client, player_ok, wallet_ok):
        result = _make_result()
        with patch("app.routers.slots.spin_slots", return_value=result):
            resp = await client.post(
                "/games/slots/spin",
                json={"bet": 10.0},
                headers={"X-User-Id": "user-123"},
            )
        assert resp.status_code == 200
        assert resp.json()["win"] is False

    async def test_spin_win_credits_wallet(self, client, player_ok, wallet_ok):
        debit_mock, credit_mock = wallet_ok
        result = _make_result(win=True, payout=50.0, multiplier=5.0)
        with patch("app.routers.slots.spin_slots", return_value=result):
            await client.post(
                "/games/slots/spin",
                json={"bet": 10.0},
                headers={"X-User-Id": "user-123"},
            )
        credit_mock.assert_awaited_once()

    async def test_spin_no_win_no_credit(self, client, player_ok, wallet_ok):
        debit_mock, credit_mock = wallet_ok
        result = _make_result(win=False, payout=0.0)
        with patch("app.routers.slots.spin_slots", return_value=result):
            await client.post(
                "/games/slots/spin",
                json={"bet": 10.0},
                headers={"X-User-Id": "user-123"},
            )
        credit_mock.assert_not_awaited()

    async def test_spin_bet_below_min_rejected(self, client, player_ok):
        resp = await client.post(
            "/games/slots/spin",
            json={"bet": 0.5},
            headers={"X-User-Id": "user-123"},
        )
        assert resp.status_code == 400

    async def test_spin_bet_above_max_rejected(self, client, player_ok):
        resp = await client.post(
            "/games/slots/spin",
            json={"bet": 501.0},
            headers={"X-User-Id": "user-123"},
        )
        assert resp.status_code == 400

    async def test_spin_banned_player_rejected(self, client):
        with patch(
            "app.routers.slots.validate_player_critical",
            new_callable=AsyncMock,
            return_value=(False, "Account is banned"),
        ):
            resp = await client.post(
                "/games/slots/spin",
                json={"bet": 10.0},
                headers={"X-User-Id": "user-123"},
            )
        assert resp.status_code == 403

    async def test_spin_debit_called_before_spin(self, client, player_ok, wallet_ok):
        """Debit must happen even if spin loses."""
        debit_mock, _ = wallet_ok
        result = _make_result()
        with patch("app.routers.slots.spin_slots", return_value=result):
            await client.post(
                "/games/slots/spin",
                json={"bet": 10.0},
                headers={"X-User-Id": "user-123"},
            )
        debit_mock.assert_awaited_once_with("user-123", 10.0)
