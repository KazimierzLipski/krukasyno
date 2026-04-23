'use client';
import { useState, useEffect, useCallback } from 'react';
import { blackjackApi, type BlackjackGame, type BlackjackCard } from '@/lib/api';

const SUIT_SYMBOL: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};
const RED_SUITS = new Set(['hearts', 'diamonds']);

function PlayingCard({ card }: { card: BlackjackCard }) {
  if (card.hidden) {
    return (
      <div className="playing-card face-down w-14 h-20 md:w-16 md:h-24 rounded-lg border-2 border-blue-700 bg-blue-900 flex items-center justify-center text-3xl select-none">
        🂠
      </div>
    );
  }
  const isRed = RED_SUITS.has(card.suit);
  return (
    <div className={`playing-card w-14 h-20 md:w-16 md:h-24 rounded-lg text-xs font-bold p-1 ${isRed ? 'red' : ''} flex flex-col justify-between`}>
      <div className="leading-none">{card.rank}<br />{SUIT_SYMBOL[card.suit]}</div>
      <div className="text-2xl text-center leading-none">{SUIT_SYMBOL[card.suit]}</div>
      <div className="leading-none self-end rotate-180">{card.rank}<br />{SUIT_SYMBOL[card.suit]}</div>
    </div>
  );
}

const STATUS_MESSAGES: Record<string, { text: string; color: string }> = {
  player_won: { text: '🎉 You Win!', color: 'text-green-400' },
  blackjack: { text: '🎰 Blackjack! You Win!', color: 'text-yellow-400' },
  dealer_won: { text: '💀 Dealer Wins', color: 'text-red-400' },
  push: { text: '🤝 Push — Bet Returned', color: 'text-blue-400' },
  bust: { text: '💥 Bust! Dealer Wins', color: 'text-red-400' },
  player_turn: { text: 'Your turn', color: 'text-white' },
  dealer_turn: { text: 'Dealer playing…', color: 'text-gray-400' },
};

export function BlackjackTable({ token }: { token: string }) {
  const [game, setGame] = useState<BlackjackGame | null>(null);
  const [bet, setBet] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState<number | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/wallet/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setBalance(d.balance);
      }
    } catch {}
  }, [token]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // Check for active game on mount
  useEffect(() => {
    blackjackApi.getState(token).then((g) => setGame(g as BlackjackGame)).catch(() => {});
  }, [token]);

  async function withLoading(fn: () => Promise<unknown>) {
    setLoading(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
      fetchBalance();
    }
  }

  const isTerminal = game && !['player_turn', 'dealer_turn'].includes(game.status);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black text-center mb-2">
        <span className="text-yellow-400">Black</span>jack
      </h1>

      {/* Balance */}
      {balance !== null && (
        <p className="text-center text-gray-400 mb-6">
          Balance: <span className="text-yellow-400 font-bold">{balance.toFixed(2)} chips</span>
        </p>
      )}

      <div className="casino-table p-6 md:p-10">
        {/* Dealer hand */}
        <div className="mb-6">
          <p className="text-sm text-gray-400 mb-2">
            Dealer {game ? `(${game.dealer_visible_score})` : ''}
          </p>
          <div className="flex gap-2 flex-wrap min-h-[5rem]">
            {game?.dealer_hand.map((c, i) => <PlayingCard key={i} card={c} />)}
          </div>
        </div>

        {/* Status */}
        {game && (
          <div className="text-center my-4">
            <span className={`text-xl font-bold ${STATUS_MESSAGES[game.status]?.color ?? 'text-white'}`}>
              {STATUS_MESSAGES[game.status]?.text ?? game.status}
            </span>
            {isTerminal && game.payout > 0 && (
              <p className="text-green-400 text-sm mt-1">+{game.payout.toFixed(2)} chips</p>
            )}
          </div>
        )}

        {/* Player hand */}
        <div className="mt-6">
          <p className="text-sm text-gray-400 mb-2">
            You {game ? `(${game.player_score})` : ''}
          </p>
          <div className="flex gap-2 flex-wrap min-h-[5rem]">
            {game?.player_hand.map((c, i) => <PlayingCard key={i} card={c} />)}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-8 flex flex-col items-center gap-4">
          {error && <p className="text-red-400 text-sm">{error}</p>}

          {(!game || isTerminal) ? (
            // New game controls
            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <div className="flex items-center gap-3">
                <label className="text-gray-400 text-sm">Bet:</label>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  step={10}
                  value={bet}
                  onChange={(e) => setBet(Number(e.target.value))}
                  className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-white w-28 text-center"
                />
                <span className="text-gray-400 text-sm">chips</span>
              </div>
              {/* Quick bet buttons */}
              <div className="flex gap-2">
                {[10, 25, 50, 100].map((v) => (
                  <button
                    key={v}
                    onClick={() => setBet(v)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${bet === v ? 'border-yellow-400 text-yellow-400' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <button
                className="btn-gold w-full py-3"
                disabled={loading}
                onClick={() => withLoading(async () => {
                  const g = await blackjackApi.start(token, bet);
                  setGame(g as BlackjackGame);
                })}
              >
                {loading ? 'Dealing…' : 'Deal'}
              </button>
            </div>
          ) : (
            // In-game controls
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                className="btn-gold px-8 py-3"
                disabled={loading || game.status !== 'player_turn'}
                onClick={() => withLoading(async () => setGame((await blackjackApi.hit(token)) as BlackjackGame))}
              >
                Hit
              </button>
              <button
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-8 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || game.status !== 'player_turn'}
                onClick={() => withLoading(async () => setGame((await blackjackApi.stand(token)) as BlackjackGame))}
              >
                Stand
              </button>
              {game.player_hand.length === 2 && (
                <button
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading || game.status !== 'player_turn'}
                  onClick={() => withLoading(async () => setGame((await blackjackApi.double(token)) as BlackjackGame))}
                >
                  Double
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rules */}
      <div className="mt-4 text-center text-xs text-gray-600">
        Blackjack pays 2.5× · Dealer stands on 17 · Double on first two cards
      </div>
    </div>
  );
}
