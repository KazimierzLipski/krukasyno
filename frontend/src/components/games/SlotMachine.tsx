'use client';
import { useState, useCallback } from 'react';
import { slotsApi, type SlotsResult } from '@/lib/api';

const SYMBOL_LABELS: Record<string, string> = {
  '🍒': 'Cherry',
  '🍋': 'Lemon',
  '🍊': 'Orange',
  '🍇': 'Grapes',
  '⭐': 'Star',
  '💎': 'Diamond',
  '7️⃣': 'Seven',
};

const PAYOUTS_TABLE = [
  { symbol: '7️⃣', multi: '50×' },
  { symbol: '💎', multi: '20×' },
  { symbol: '⭐', multi: '10×' },
  { symbol: '🍇', multi: '5×' },
  { symbol: '🍊', multi: '4×' },
  { symbol: '🍋', multi: '3×' },
  { symbol: '🍒', multi: '2×' },
  { symbol: '🍒🍒', multi: '1.5×' },
];

export function SlotMachine({ token }: { token: string }) {
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SlotsResult | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<SlotsResult[]>([]);
  const [displayReels, setDisplayReels] = useState(['🎰', '🎰', '🎰']);

  const animate = useCallback((final: string[]) => {
    const symbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣'];
    let count = 0;
    const interval = setInterval(() => {
      setDisplayReels(final.map((f, i) => (count < 8 - i * 2 ? symbols[Math.floor(Math.random() * symbols.length)] : f)));
      count++;
      if (count > 12) clearInterval(interval);
    }, 80);
  }, []);

  async function spin() {
    setError('');
    setSpinning(true);
    setDisplayReels(['❓', '❓', '❓']);
    try {
      const res = await slotsApi.spin(token, bet) as SlotsResult;
      animate(res.reels);
      setTimeout(() => {
        setResult(res);
        setHistory((h) => [res, ...h].slice(0, 10));
      }, 1100);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Spin failed');
      setDisplayReels(['🎰', '🎰', '🎰']);
    } finally {
      setTimeout(() => setSpinning(false), 1200);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black text-center mb-2">
        <span className="text-yellow-400">Slot</span> Machine
      </h1>

      {result && (
        <p className="text-center text-gray-400 mb-4">
          Balance: <span className="text-yellow-400 font-bold">{result.new_balance.toFixed(2)} chips</span>
        </p>
      )}

      {/* Machine */}
      <div className="casino-table p-8 flex flex-col items-center gap-6">
        {/* Reels */}
        <div className="flex gap-4">
          {displayReels.map((sym, i) => (
            <div
              key={i}
              className={`w-20 h-20 bg-white rounded-xl flex items-center justify-center text-4xl shadow-lg border-4 ${spinning ? 'border-yellow-400 animate-pulse' : 'border-gray-200'} transition-all`}
            >
              {sym}
            </div>
          ))}
        </div>

        {/* Result message */}
        {result && !spinning && (
          <div className="text-center">
            {result.win ? (
              <p className="text-green-400 text-xl font-bold">
                🎉 {result.multiplier}× — +{result.payout.toFixed(2)} chips!
              </p>
            ) : (
              <p className="text-red-400 text-lg font-bold">No win this time</p>
            )}
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Bet & spin */}
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          <div className="flex items-center gap-3">
            <label className="text-gray-400 text-sm">Bet:</label>
            <input
              type="number"
              min={1}
              max={500}
              value={bet}
              onChange={(e) => setBet(Number(e.target.value))}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-white w-24 text-center"
            />
            <span className="text-gray-400 text-sm">chips</span>
          </div>
          <div className="flex gap-2">
            {[1, 5, 10, 25, 50].map((v) => (
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
            className="btn-gold w-full py-4 text-lg"
            disabled={spinning}
            onClick={spin}
          >
            {spinning ? 'Spinning…' : '🎰 SPIN'}
          </button>
        </div>
      </div>

      {/* Paytable */}
      <div className="mt-6 bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Paytable (3 matching)</h3>
        <div className="grid grid-cols-4 gap-2">
          {PAYOUTS_TABLE.map((row) => (
            <div key={row.symbol} className="text-center">
              <div className="text-xl">{row.symbol}</div>
              <div className="text-yellow-400 text-xs font-bold">{row.multi}</div>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="mt-4 bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Recent Spins</h3>
          <div className="space-y-1">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>{h.reels.join(' ')}</span>
                <span className={h.win ? 'text-green-400' : 'text-red-400'}>
                  {h.win ? `+${h.payout.toFixed(0)}` : `-${h.bet.toFixed(0)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
