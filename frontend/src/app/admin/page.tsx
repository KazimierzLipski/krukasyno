'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { adminApi, type AdminUser } from '@/lib/api';

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [session, router]);

  async function load(p = 1, q = search) {
    if (!session?.applicationToken) return;
    setLoading(true);
    try {
      const d = await adminApi.listUsers(session.applicationToken, p, q);
      setUsers(d.users);
      setTotal(d.total);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.applicationToken && session.user.role === 'ADMIN') load(1, '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function toggleBan(user: AdminUser) {
    if (!session?.applicationToken) return;
    setMsg('');
    try {
      if (user.isBanned) {
        await adminApi.unbanUser(session.applicationToken, user.id);
        setMsg(`${user.username} unbanned`);
      } else {
        await adminApi.banUser(session.applicationToken, user.id);
        setMsg(`${user.username} banned`);
      }
      load(page, search);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  if (session?.user?.role !== 'ADMIN') return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
      <p className="text-gray-400 mb-6">Manage users and permissions</p>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by email or username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load(1, search); } }}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-yellow-400"
        />
        <button onClick={() => { setPage(1); load(1, search); }} className="btn-gold px-5">
          Search
        </button>
      </div>

      {msg && (
        <p className="mb-4 text-center text-sm text-yellow-400">{msg}</p>
      )}

      {/* Users table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-left">
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No users found</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-gray-800 last:border-b-0">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-gray-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${u.role === 'ADMIN' ? 'bg-red-900/50 text-red-400' : 'bg-gray-800 text-gray-400'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${u.isBanned ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
                      {u.isBanned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {u.role !== 'ADMIN' && (
                      <button
                        onClick={() => toggleBan(u)}
                        className={`text-xs px-3 py-1 rounded font-medium transition-colors ${u.isBanned ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-red-800 hover:bg-red-700 text-white'}`}
                      >
                        {u.isBanned ? 'Unban' : 'Ban'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4 text-sm">
          <button disabled={page === 1} onClick={() => { const p = page - 1; setPage(p); load(p); }} className="px-3 py-1 rounded bg-gray-800 disabled:opacity-50">‹</button>
          <span className="px-3 py-1 text-gray-400">{page} / {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => { const p = page + 1; setPage(p); load(p); }} className="px-3 py-1 rounded bg-gray-800 disabled:opacity-50">›</button>
        </div>
      )}
    </div>
  );
}
