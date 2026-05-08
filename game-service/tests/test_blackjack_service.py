import pytest
from unittest.mock import patch

from app.models.game_models import Card, Suit, BlackjackStatus
import app.services.blackjack_service as svc


def _card(rank: str, suit: Suit = Suit.hearts, hidden: bool = False) -> Card:
    return Card(suit=suit, rank=rank, hidden=hidden)


# Pop order in start_game:
#   deck.pop() → player card 1
#   deck.pop() → player card 2
#   deck.pop() → dealer visible card
#   deck.pop() → dealer hidden card SUIT  (from deck.pop().suit)
#   deck.pop() → dealer hidden card RANK  (from deck.pop().rank)
#
# So _make_deck builds list in REVERSE pop order:
#   index 0 = last popped  (dealer hidden rank source)
#   index 1 = 4th popped   (dealer hidden suit source)
#   index 2 = 3rd popped   (dealer visible)
#   index 3 = 2nd popped   (player card 2)
#   index 4 = 1st popped   (player card 1)
#
# Any extra cards at the front are available for hit/stand draws.


class TestHandScore:
    def test_simple_sum(self):
        hand = [_card("5"), _card("6")]
        assert svc._hand_score(hand) == 11

    def test_blackjack(self):
        assert svc._hand_score([_card("A"), _card("K")]) == 21

    def test_soft_ace_downgrade(self):
        assert svc._hand_score([_card("A"), _card("5"), _card("7")]) == 13

    def test_multiple_aces(self):
        assert svc._hand_score([_card("A"), _card("A")]) == 12

    def test_hidden_cards_excluded(self):
        hand = [_card("10"), _card("K", hidden=True)]
        assert svc._hand_score(hand) == 10

    def test_face_cards_worth_10(self):
        for rank in ("J", "Q", "K"):
            assert svc._hand_score([_card(rank), _card("5")]) == 15


class TestStartGame:
    @pytest.mark.asyncio
    async def test_returns_game_with_two_cards_each(self):
        # 5 cards needed for start_game
        # pop order: player1=7, player2=K, dealer_visible=9, hidden_suit_src=5, hidden_rank_src=8
        deck_cards = [_card("8"), _card("5"), _card("9"), _card("K"), _card("7")]
        with patch.object(svc, "_build_deck", return_value=deck_cards):
            game = await svc.start_game("u1", 10.0)

        assert len(game.player_hand) == 2
        assert len(game.dealer_hand) == 2
        assert game.bet == 10.0
        assert game.user_id == "u1"

    @pytest.mark.asyncio
    async def test_natural_blackjack_status(self):
        # Player: A + K = 21 (blackjack); dealer visible=9, hidden=5 → 14
        # pop order: player1=A, player2=K, dealer_visible=9, hidden_suit=5, hidden_rank=5
        deck_cards = [_card("5"), _card("5"), _card("9"), _card("K"), _card("A")]
        with patch.object(svc, "_build_deck", return_value=deck_cards):
            game = await svc.start_game("u1", 10.0)

        assert game.status == BlackjackStatus.blackjack
        assert game.payout == pytest.approx(25.0)  # bet * 2.5

    @pytest.mark.asyncio
    async def test_push_on_double_blackjack(self):
        # Player: A + K = 21; Dealer: K (visible) + A (hidden) = 21
        # pop order: player1=A, player2=K, dealer_visible=K, hidden_suit=A, hidden_rank=A
        deck_cards = [_card("A"), _card("A"), _card("K"), _card("K"), _card("A")]
        with patch.object(svc, "_build_deck", return_value=deck_cards):
            game = await svc.start_game("u1", 10.0)

        assert game.status == BlackjackStatus.push
        assert game.payout == pytest.approx(10.0)

    @pytest.mark.asyncio
    async def test_player_turn_when_no_blackjack(self):
        # Player: 7 + 8 = 15; Dealer: 9 + 5 = 14 (visible only 9)
        deck_cards = [_card("5"), _card("5"), _card("9"), _card("8"), _card("7")]
        with patch.object(svc, "_build_deck", return_value=deck_cards):
            game = await svc.start_game("u1", 10.0)

        assert game.status == BlackjackStatus.player_turn
        assert game.payout == 0.0

    @pytest.mark.asyncio
    async def test_game_persisted_in_redis(self, fake_redis_patch):
        deck_cards = [_card("5"), _card("5"), _card("9"), _card("8"), _card("7")]
        with patch.object(svc, "_build_deck", return_value=deck_cards):
            await svc.start_game("u1", 10.0)

        game = await svc.get_game("u1")
        assert game is not None
        assert game.user_id == "u1"


class TestHit:
    @pytest.mark.asyncio
    async def test_hit_adds_card(self, fake_redis_patch):
        # Extra card at front = hit card (popped last from remaining deck)
        # Start: player=7+8=15, dealer visible=9
        # Remaining after deal: [_card("2")] → hit draws "2"
        deck_cards = [_card("2"), _card("5"), _card("5"), _card("9"), _card("8"), _card("7")]
        with patch.object(svc, "_build_deck", return_value=deck_cards):
            await svc.start_game("u1", 10.0)

        game = await svc.hit("u1")
        assert len(game.player_hand) == 3

    @pytest.mark.asyncio
    async def test_hit_bust(self, fake_redis_patch):
        # Player: 10+9=19, hits K → 29 → bust
        # pop order: player1=10, player2=9, dealer_visible=6, hidden×2=5,5
        # remaining after deal: [K] → hit card
        deck_cards = [_card("K"), _card("5"), _card("5"), _card("6"), _card("9"), _card("10")]
        with patch.object(svc, "_build_deck", return_value=deck_cards):
            await svc.start_game("u1", 10.0)

        game = await svc.hit("u1")
        assert game.status == BlackjackStatus.bust
        assert game.payout == 0.0

    @pytest.mark.asyncio
    async def test_hit_on_terminal_game_returns_unchanged(self, fake_redis_patch):
        deck_cards = [_card("K"), _card("5"), _card("5"), _card("6"), _card("9"), _card("10")]
        with patch.object(svc, "_build_deck", return_value=deck_cards):
            await svc.start_game("u1", 10.0)

        # First hit → bust, key deleted
        await svc.hit("u1")

        # Second hit → None (no game in redis)
        result = await svc.hit("u1")
        assert result is None


class TestStand:
    @pytest.mark.asyncio
    async def test_player_wins(self, fake_redis_patch):
        # Player: 10+9=19
        # Dealer visible=5, hidden=6 → revealed score=11 → draws 4→15 → draws 3→18
        # pop order: player1=10, player2=9, dealer_visible=5, hidden×2=6,6
        # remaining after deal (front of list): [3, 4] → dealer draws
        deck_cards = [_card("3"), _card("4"), _card("6"), _card("6"), _card("5"), _card("9"), _card("10")]
        with patch.object(svc, "_build_deck", return_value=deck_cards):
            await svc.start_game("u1", 10.0)

        game = await svc.stand("u1")
        # dealer ends at 18, player at 19 → player wins
        assert game.status == BlackjackStatus.player_won
        assert game.payout == pytest.approx(20.0)

    @pytest.mark.asyncio
    async def test_dealer_bust_player_wins(self, fake_redis_patch):
        # Player: 10+8=18
        # Dealer visible=10, hidden=6 → revealed=16 → draws K → 26 → bust
        # pop order: player1=10, player2=8, dealer_visible=10, hidden×2=6,6
        # remaining after deal: [K] → dealer draws
        deck_cards = [_card("K"), _card("6"), _card("6"), _card("10"), _card("8"), _card("10")]
        with patch.object(svc, "_build_deck", return_value=deck_cards):
            await svc.start_game("u1", 10.0)

        game = await svc.stand("u1")
        assert game.status == BlackjackStatus.player_won
        assert game.payout == pytest.approx(20.0)

    @pytest.mark.asyncio
    async def test_push(self, fake_redis_patch):
        # Player: 10+8=18; Dealer: 10+8=18 (no draw needed, 18 >= 17)
        # pop order: player1=10, player2=8, dealer_visible=10, hidden×2=8,8
        deck_cards = [_card("8"), _card("8"), _card("10"), _card("8"), _card("10")]
        with patch.object(svc, "_build_deck", return_value=deck_cards):
            await svc.start_game("u1", 10.0)

        game = await svc.stand("u1")
        assert game.status == BlackjackStatus.push
        assert game.payout == pytest.approx(10.0)

    @pytest.mark.asyncio
    async def test_dealer_wins(self, fake_redis_patch):
        # Player: 7+8=15; Dealer: 10+9=19 (no draw needed)
        # pop order: player1=7, player2=8, dealer_visible=10, hidden×2=9,9
        deck_cards = [_card("9"), _card("9"), _card("10"), _card("8"), _card("7")]
        with patch.object(svc, "_build_deck", return_value=deck_cards):
            await svc.start_game("u1", 10.0)

        game = await svc.stand("u1")
        assert game.status == BlackjackStatus.dealer_won
        assert game.payout == 0.0


class TestDoubleDown:
    @pytest.mark.asyncio
    async def test_double_bust(self, fake_redis_patch):
        # Player: 10+9=19, doubles → hits K → 29 → bust
        # pop order: player1=10, player2=9, dealer_visible=6, hidden×2=5,5
        # remaining: [K] → double card
        deck_cards = [_card("K"), _card("5"), _card("5"), _card("6"), _card("9"), _card("10")]
        with patch.object(svc, "_build_deck", return_value=deck_cards):
            await svc.start_game("u1", 10.0)

        game = await svc.double_down("u1")
        assert game.status == BlackjackStatus.bust
        assert game.payout == 0.0