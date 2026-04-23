'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { walletApi, type Transaction } from '@/lib/api';

export default function DashboardPage() {
  const { data: session } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);

  useEffect(() => {
    if (!session?.applicationToken) return;
    walletApi.getBalance(session.applicationToken).then((d) => setBalance(d.balance)).catch(() => {});
    walletApi.getTransactions(session.applicationToken, 1, 5).then((d) => setTxs(d.transactions)).catch(() => {});
  }, [session]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">
        Welcome back, <span className="text-yellow-400">{session?.user?.username ?? session?.user?.name}</span>!
      </h1>
      <p className="text-gray-400 mb-8">Good luck at the tables.</p>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-yellow-400/20 to-yellow-600/10 border border-yellow-400/30 rounded-2xl p-6 mb-8 flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">Your Balance</p>
          <p className="text-4xl font-black text-yellow-400">
            {balance !== null ? `${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} chips` : '…'}
          </p>
        </div>
        <Link href="/wallet" className="btn-gold">Manage Wallet</Link>
      </div>

      {/* Games */}
      <h2 className="text-xl font-bold mb-4">Games</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <Link
          href="/games/blackjack"
          className="casino-table p-6 hover:scale-[1.02] transition-transform cursor-pointer flex items-center gap-4"
        >
          <span className="text-4xl">🃏</span>
          <div>
            <h3 className="text-xl font-bold text-yellow-400">Blackjack</h3>
            <p className="text-gray-300 text-sm">Beat the dealer — min bet 10</p>
          </div>
        </Link>
        <Link
          href="/games/slots"
          className="casino-table p-6 hover:scale-[1.02] transition-transform cursor-pointer flex items-center gap-4"
        >
          <span className="text-4xl">🎰</span>
          <div>
            <h3 className="text-xl font-bold text-yellow-400">Slots</h3>
            <p className="text-gray-300 text-sm">Spin to win — up to 50×</p>
          </div>
        </Link>
      </div>

      {/* Recent transactions */}
      {txs.length > 0 && (
        <>
          <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            {txs.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-b-0">
                <div>
                  <p className="text-sm font-medium capitalize">{tx.type}</p>
                  <p className="text-xs text-gray-500">{tx.description ?? '—'}</p>
                </div>
                <span className={`font-mono font-bold text-sm ${['win','deposit','refund'].includes(tx.type) ? 'text-green-400' : 'text-red-400'}`}>
                  {['win','deposit','refund'].includes(tx.type) ? '+' : '-'}{tx.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
