'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { walletApi, type Transaction } from '@/lib/api';

export default function WalletPage() {
  const { data: session } = useSession();
  const token = session?.applicationToken ?? '';

  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');

  async function loadBalance() {
    if (!token) return;
    walletApi.getBalance(token).then((d) => setBalance(d.balance)).catch(() => {});
  }

  async function loadTxs(p: number) {
    if (!token) return;
    const d = await walletApi.getTransactions(token, p, 10);
    setTxs(d.transactions);
    setTotal(d.total);
  }

  useEffect(() => {
    loadBalance();
    loadTxs(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) return;
    setLoading(true);
    setMsg('');
    try {
      const fn = tab === 'deposit' ? walletApi.deposit : walletApi.withdraw;
      const res = await fn(token, n);
      setBalance(res.balance);
      setMsg(res.message);
      setAmount('');
      loadTxs(1);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Wallet</h1>

      {/* Balance */}
      <div className="bg-gradient-to-br from-yellow-400/20 to-yellow-600/10 border border-yellow-400/30 rounded-2xl p-6 mb-6">
        <p className="text-gray-400 text-sm">Current Balance</p>
        <p className="text-5xl font-black text-yellow-400 mt-1">
          {balance !== null ? balance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '…'}
          <span className="text-2xl ml-2 text-yellow-600">chips</span>
        </p>
      </div>

      {/* Deposit / Withdraw */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
        <div className="flex gap-2 mb-4">
          {(['deposit', 'withdraw'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg font-medium capitalize transition-colors ${tab === t ? 'bg-yellow-400 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="number"
            min="1"
            max="10000"
            step="1"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-400"
          />
          <button type="submit" disabled={loading} className="btn-gold px-6">
            {loading ? '…' : tab === 'deposit' ? 'Deposit' : 'Withdraw'}
          </button>
        </form>

        {msg && (
          <p className={`mt-3 text-sm text-center ${msg.toLowerCase().includes('err') || msg.toLowerCase().includes('insufficient') ? 'text-red-400' : 'text-green-400'}`}>
            {msg}
          </p>
        )}
      </div>

      {/* Transaction History */}
      <h2 className="text-xl font-bold mb-3">Transaction History</h2>
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {txs.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No transactions yet</p>
        ) : (
          txs.map((tx) => {
            const isCredit = ['win', 'deposit', 'refund'].includes(tx.type);
            return (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-b-0 text-sm">
                <div>
                  <p className="font-medium capitalize">{tx.type}</p>
                  <p className="text-gray-500 text-xs">{tx.description ?? '—'}</p>
                  <p className="text-gray-600 text-xs">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
                <span className={`font-mono font-bold ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
                  {isCredit ? '+' : '-'}{tx.amount.toFixed(2)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {total > 10 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            disabled={page === 1}
            onClick={() => { const p = page - 1; setPage(p); loadTxs(p); }}
            className="px-3 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50"
          >
            ‹
          </button>
          <span className="px-3 py-1 text-gray-400 text-sm">{page} / {Math.ceil(total / 10)}</span>
          <button
            disabled={page >= Math.ceil(total / 10)}
            onClick={() => { const p = page + 1; setPage(p); loadTxs(p); }}
            className="px-3 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
