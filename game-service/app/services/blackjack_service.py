import json
import random
import uuid
from typing import List, Tuple

import redis.asyncio as aioredis

from ..config import settings
from ..models.game_models import Card, Suit, BlackjackGame, BlackjackStatus

RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def _build_deck() -> List[Card]:
    deck = [Card(suit=s, rank=r) for s in Suit for r in RANKS]
    random.shuffle(deck)
    return deck


def _card_value(rank: str) -> int:
    if rank in ("J", "Q", "K", "10"):
        return 10
    if rank == "A":
        return 11
    return int(rank)


def _hand_score(hand: List[Card]) -> int:
    score = sum(_card_value(c.rank) for c in hand if not c.hidden)
    aces = sum(1 for c in hand if c.rank == "A" and not c.hidden)
    while score > 21 and aces:
        score -= 10
        aces -= 1
    return score


def _reveal_dealer(hand: List[Card]) -> List[Card]:
    return [Card(suit=c.suit, rank=c.rank, hidden=False) for c in hand]


async def start_game(user_id: str, bet: float) -> BlackjackGame:
    r = await get_redis()
    deck = _build_deck()

    player_hand = [deck.pop(), deck.pop()]
    dealer_hand = [deck.pop(), Card(suit=deck.pop().suit, rank=deck.pop().rank, hidden=True)]

    player_score = _hand_score(player_hand)
    dealer_visible = _hand_score([c for c in dealer_hand if not c.hidden])

    # Check natural blackjack
    status = BlackjackStatus.player_turn
    payout = 0.0
    if player_score == 21:
        # Reveal dealer
        dealer_full = _reveal_dealer(dealer_hand)
        dealer_score = _hand_score(dealer_full)
        if dealer_score == 21:
            status = BlackjackStatus.push
            payout = bet
        else:
            status = BlackjackStatus.blackjack
            payout = bet * 2.5

    game = BlackjackGame(
        game_id=str(uuid.uuid4()),
        user_id=user_id,
        bet=bet,
        player_hand=player_hand,
        dealer_hand=dealer_hand if status == BlackjackStatus.player_turn else _reveal_dealer(dealer_hand),
        player_score=player_score,
        dealer_visible_score=dealer_visible,
        status=status,
        payout=payout,
    )

    # Persist remaining deck and game in Redis
    key = f"game:blackjack:{user_id}"
    data = {
        "game": game.model_dump_json(),
        "deck": json.dumps([c.model_dump() for c in deck]),
    }
    await r.hset(key, mapping=data)
    await r.expire(key, settings.game_session_ttl)

    return game


async def get_game(user_id: str) -> BlackjackGame | None:
    r = await get_redis()
    raw = await r.hget(f"game:blackjack:{user_id}", "game")
    if not raw:
        return None
    return BlackjackGame.model_validate_json(raw)


async def hit(user_id: str) -> BlackjackGame | None:
    r = await get_redis()
    key = f"game:blackjack:{user_id}"
    raw_game = await r.hget(key, "game")
    raw_deck = await r.hget(key, "deck")

    if not raw_game or not raw_deck:
        return None

    game = BlackjackGame.model_validate_json(raw_game)
    if game.status != BlackjackStatus.player_turn:
        return game

    deck_data = json.loads(raw_deck)
    deck = [Card(**c) for c in deck_data]

    new_card = deck.pop()
    game.player_hand.append(new_card)
    game.player_score = _hand_score(game.player_hand)

    if game.player_score > 21:
        game.status = BlackjackStatus.bust
        game.dealer_hand = _reveal_dealer(game.dealer_hand)
        game.payout = 0.0
        await r.delete(key)
    else:
        await r.hset(key, mapping={
            "game": game.model_dump_json(),
            "deck": json.dumps([c.model_dump() for c in deck]),
        })
        await r.expire(key, settings.game_session_ttl)

    return game


async def stand(user_id: str) -> BlackjackGame | None:
    r = await get_redis()
    key = f"game:blackjack:{user_id}"
    raw_game = await r.hget(key, "game")
    raw_deck = await r.hget(key, "deck")

    if not raw_game or not raw_deck:
        return None

    game = BlackjackGame.model_validate_json(raw_game)
    if game.status != BlackjackStatus.player_turn:
        return game

    deck_data = json.loads(raw_deck)
    deck = [Card(**c) for c in deck_data]

    # Reveal dealer's hidden card
    game.dealer_hand = _reveal_dealer(game.dealer_hand)

    # Dealer draws until 17+
    dealer_score = _hand_score(game.dealer_hand)
    while dealer_score < 17:
        game.dealer_hand.append(deck.pop())
        dealer_score = _hand_score(game.dealer_hand)

    game.dealer_visible_score = dealer_score
    player_score = game.player_score

    if dealer_score > 21 or player_score > dealer_score:
        game.status = BlackjackStatus.player_won
        game.payout = game.bet * 2
    elif player_score == dealer_score:
        game.status = BlackjackStatus.push
        game.payout = game.bet
    else:
        game.status = BlackjackStatus.dealer_won
        game.payout = 0.0

    await r.delete(key)
    return game


async def double_down(user_id: str) -> BlackjackGame | None:
    r = await get_redis()
    key = f"game:blackjack:{user_id}"
    raw_game = await r.hget(key, "game")
    raw_deck = await r.hget(key, "deck")

    if not raw_game or not raw_deck:
        return None

    game = BlackjackGame.model_validate_json(raw_game)
    if game.status != BlackjackStatus.player_turn or len(game.player_hand) != 2:
        return game

    deck_data = json.loads(raw_deck)
    deck = [Card(**c) for c in deck_data]

    # Double the bet
    game.bet *= 2

    # Take exactly one card
    new_card = deck.pop()
    game.player_hand.append(new_card)
    game.player_score = _hand_score(game.player_hand)

    if game.player_score > 21:
        game.status = BlackjackStatus.bust
        game.dealer_hand = _reveal_dealer(game.dealer_hand)
        game.payout = 0.0
        await r.delete(key)
        return game

    # Then stand automatically
    game.dealer_hand = _reveal_dealer(game.dealer_hand)
    dealer_score = _hand_score(game.dealer_hand)
    while dealer_score < 17:
        game.dealer_hand.append(deck.pop())
        dealer_score = _hand_score(game.dealer_hand)

    game.dealer_visible_score = dealer_score

    if dealer_score > 21 or game.player_score > dealer_score:
        game.status = BlackjackStatus.player_won
        game.payout = game.bet * 2
    elif game.player_score == dealer_score:
        game.status = BlackjackStatus.push
        game.payout = game.bet
    else:
        game.status = BlackjackStatus.dealer_won
        game.payout = 0.0

    await r.delete(key)
    return game
