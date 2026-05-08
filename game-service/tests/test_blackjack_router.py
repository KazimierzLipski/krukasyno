import pytest
from unittest.mock import AsyncMock, patch

from app.models.game_models import BlackjackGame, BlackjackStatus, Card, Suit


def _make_game(status=BlackjackStatus.player_turn, payout=0.0, bet=10.0):
    return BlackjackGame(
        game_id="game-1",
        user_id="user-123",
        bet=bet,
        player_hand=[
            Card(suit=Suit.hearts, rank="10"),
            Card(suit=Suit.spades, rank="8"),
        ],
        dealer_hand=[
            Card(suit=Suit.diamonds, rank="6"),
            Card(suit=Suit.clubs, rank="5", hidden=True),
        ],
        player_score=18,
        dealer_visible_score=6,
        status=status,
        payout=payout,
    )


@pytest.mark.asyncio
class TestStartEndpoint:
    async def test_start_success(self, client, player_ok, wallet_ok):
        game = _make_game()
        with patch("app.routers.blackjack.blackjack_service.get_game", AsyncMock(return_value=None)), \
             patch("app.routers.blackjack.blackjack_service.start_game", AsyncMock(return_value=game)):
            resp = await client.post(
                "/games/blackjack/start",
                json={"bet": 10.0},
                headers={"X-User-Id": "user-123"},
            )
        assert resp.status_code == 200
        assert resp.json()["status"] == "player_turn"

    async def test_start_zero_bet_rejected(self, client, player_ok):
        resp = await client.post(
            "/games/blackjack/start",
            json={"bet": 0},
            headers={"X-User-Id": "user-123"},
        )
        assert resp.status_code == 400

    async def test_start_negative_bet_rejected(self, client, player_ok):
        resp = await client.post(
            "/games/blackjack/start",
            json={"bet": -5.0},
            headers={"X-User-Id": "user-123"},
        )
        assert resp.status_code == 400

    async def test_start_blocks_if_active_game(self, client, player_ok):
        active = _make_game(status=BlackjackStatus.player_turn)
        with patch("app.routers.blackjack.blackjack_service.get_game", AsyncMock(return_value=active)):
            resp = await client.post(
                "/games/blackjack/start",
                json={"bet": 10.0},
                headers={"X-User-Id": "user-123"},
            )
        assert resp.status_code == 409

    async def test_start_banned_player_rejected(self, client, wallet_ok):
        with patch(
            "app.routers.blackjack.validate_player_critical",
            new_callable=AsyncMock,
            return_value=(False, "Account is banned"),
        ):
            resp = await client.post(
                "/games/blackjack/start",
                json={"bet": 10.0},
                headers={"X-User-Id": "user-123"},
            )
        assert resp.status_code == 403

    async def test_start_credits_on_immediate_blackjack(self, client, player_ok, wallet_ok):
        debit_mock, credit_mock = wallet_ok
        game = _make_game(status=BlackjackStatus.blackjack, payout=25.0)
        with patch("app.routers.blackjack.blackjack_service.get_game", AsyncMock(return_value=None)), \
             patch("app.routers.blackjack.blackjack_service.start_game", AsyncMock(return_value=game)):
            await client.post(
                "/games/blackjack/start",
                json={"bet": 10.0},
                headers={"X-User-Id": "user-123"},
            )
        credit_mock.assert_awaited_once()


@pytest.mark.asyncio
class TestHitEndpoint:
    async def test_hit_success(self, client):
        game = _make_game()
        with patch("app.routers.blackjack.blackjack_service.hit", AsyncMock(return_value=game)):
            resp = await client.post("/games/blackjack/hit", headers={"X-User-Id": "user-123"})
        assert resp.status_code == 200

    async def test_hit_no_game(self, client):
        with patch("app.routers.blackjack.blackjack_service.hit", AsyncMock(return_value=None)):
            resp = await client.post("/games/blackjack/hit", headers={"X-User-Id": "user-123"})
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestStandEndpoint:
    async def test_stand_win_credits_wallet(self, client, wallet_ok):
        debit_mock, credit_mock = wallet_ok
        game = _make_game(status=BlackjackStatus.player_won, payout=20.0)
        with patch("app.routers.blackjack.blackjack_service.stand", AsyncMock(return_value=game)):
            resp = await client.post("/games/blackjack/stand", headers={"X-User-Id": "user-123"})
        assert resp.status_code == 200
        credit_mock.assert_awaited_once_with("user-123", 20.0, "game-1", "Blackjack win")

    async def test_stand_dealer_wins_no_credit(self, client, wallet_ok):
        debit_mock, credit_mock = wallet_ok
        game = _make_game(status=BlackjackStatus.dealer_won, payout=0.0)
        with patch("app.routers.blackjack.blackjack_service.stand", AsyncMock(return_value=game)):
            await client.post("/games/blackjack/stand", headers={"X-User-Id": "user-123"})
        credit_mock.assert_not_awaited()

    async def test_stand_no_game(self, client):
        with patch("app.routers.blackjack.blackjack_service.stand", AsyncMock(return_value=None)):
            resp = await client.post("/games/blackjack/stand", headers={"X-User-Id": "user-123"})
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestDoubleEndpoint:
    async def test_double_only_on_two_cards(self, client, wallet_ok):
        """Three-card hand → 400."""
        game = _make_game()
        game.player_hand.append(Card(suit=Suit.hearts, rank="2"))
        with patch("app.routers.blackjack.blackjack_service.get_game", AsyncMock(return_value=game)):
            resp = await client.post("/games/blackjack/double", headers={"X-User-Id": "user-123"})
        assert resp.status_code == 400

    async def test_double_no_game(self, client):
        with patch("app.routers.blackjack.blackjack_service.get_game", AsyncMock(return_value=None)):
            resp = await client.post("/games/blackjack/double", headers={"X-User-Id": "user-123"})
        assert resp.status_code == 404

    async def test_double_win_credits_doubled_payout(self, client, wallet_ok):
        debit_mock, credit_mock = wallet_ok
        existing = _make_game(bet=10.0)
        result = _make_game(status=BlackjackStatus.player_won, payout=40.0, bet=20.0)
        with patch("app.routers.blackjack.blackjack_service.get_game", AsyncMock(return_value=existing)), \
             patch("app.routers.blackjack.blackjack_service.double_down", AsyncMock(return_value=result)):
            resp = await client.post("/games/blackjack/double", headers={"X-User-Id": "user-123"})
        assert resp.status_code == 200
        # Should debit the extra bet
        debit_mock.assert_awaited_once_with("user-123", 10.0, "game-1")
        credit_mock.assert_awaited_once_with("user-123", 40.0, "game-1", "Blackjack double win")


@pytest.mark.asyncio
class TestGetStateEndpoint:
    async def test_get_state_ok(self, client):
        game = _make_game()
        with patch("app.routers.blackjack.blackjack_service.get_game", AsyncMock(return_value=game)):
            resp = await client.get("/games/blackjack/state", headers={"X-User-Id": "user-123"})
        assert resp.status_code == 200
        assert resp.json()["game_id"] == "game-1"

    async def test_get_state_404(self, client):
        with patch("app.routers.blackjack.blackjack_service.get_game", AsyncMock(return_value=None)):
            resp = await client.get("/games/blackjack/state", headers={"X-User-Id": "user-123"})
        assert resp.status_code == 404
