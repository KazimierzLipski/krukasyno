/**
 * API client — wraps fetch with auth token injection.
 * Uses NEXT_PUBLIC_API_URL for browser calls (through NGINX).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost/api';

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(customHeaders ?? {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error ?? err.detail ?? 'Request failed');
  }

  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
};

// ── Wallet ────────────────────────────────────────────
export const walletApi = {
  getBalance: (token: string) =>
    apiFetch<{ balance: number; userId: string }>('/wallet/balance', { token }),

  deposit: (token: string, amount: number) =>
    apiFetch<{ balance: number; message: string }>('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount }),
      token,
    }),

  withdraw: (token: string, amount: number) =>
    apiFetch<{ balance: number; message: string }>('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount }),
      token,
    }),

  getTransactions: (token: string, page = 1, limit = 20) =>
    apiFetch<{
      transactions: Transaction[];
      total: number;
      page: number;
      limit: number;
    }>(`/wallet/transactions?page=${page}&limit=${limit}`, { token }),
};

// ── Games ─────────────────────────────────────────────
export const blackjackApi = {
  start: (token: string, bet: number) =>
    apiFetch('/games/blackjack/start', {
      method: 'POST',
      body: JSON.stringify({ bet }),
      token,
    }),

  getState: (token: string) =>
    apiFetch('/games/blackjack/state', { token }),

  hit: (token: string) =>
    apiFetch('/games/blackjack/hit', { method: 'POST', body: '{}', token }),

  stand: (token: string) =>
    apiFetch('/games/blackjack/stand', { method: 'POST', body: '{}', token }),

  double: (token: string) =>
    apiFetch('/games/blackjack/double', { method: 'POST', body: '{}', token }),
};

export const slotsApi = {
  spin: (token: string, bet: number) =>
    apiFetch('/games/slots/spin', {
      method: 'POST',
      body: JSON.stringify({ bet }),
      token,
    }),
};

// ── Admin ─────────────────────────────────────────────
export const adminApi = {
  listUsers: (token: string, page = 1, search = '') =>
    apiFetch<{ users: AdminUser[]; total: number; page: number; limit: number }>(
      `/auth/admin/users?page=${page}&search=${encodeURIComponent(search)}`,
      { token }
    ),

  banUser: (token: string, id: string) =>
    apiFetch(`/auth/admin/users/${id}/ban`, { method: 'POST', body: '{}', token }),

  unbanUser: (token: string, id: string) =>
    apiFetch(`/auth/admin/users/${id}/unban`, { method: 'POST', body: '{}', token }),
};

// ── Types ─────────────────────────────────────────────
export interface Transaction {
  id: string;
  amount: number;
  type: string;
  description?: string;
  gameSessionId?: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: string;
  isBanned: boolean;
  createdAt: string;
}

export interface BlackjackCard {
  suit: string;
  rank: string;
  hidden: boolean;
}

export interface BlackjackGame {
  game_id: string;
  user_id: string;
  bet: number;
  player_hand: BlackjackCard[];
  dealer_hand: BlackjackCard[];
  player_score: number;
  dealer_visible_score: number;
  status: string;
  payout: number;
}

export interface SlotsResult {
  reels: string[];
  win: boolean;
  multiplier: number;
  payout: number;
  bet: number;
  new_balance: number;
}
