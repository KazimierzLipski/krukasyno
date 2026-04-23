'use client';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur-md border-b border-gray-800 h-16 flex items-center px-6">
      <Link href="/" className="font-black text-xl tracking-tight mr-8">
        <span className="text-yellow-400">KRU</span>
        <span className="text-white">KASYNO</span>
      </Link>

      {session && (
        <div className="flex items-center gap-4 flex-1">
          <Link
            href="/dashboard"
            className={`text-sm font-medium transition-colors ${pathname === '/dashboard' ? 'text-yellow-400' : 'text-gray-400 hover:text-white'}`}
          >
            Dashboard
          </Link>
          <Link
            href="/games/blackjack"
            className={`text-sm font-medium transition-colors ${pathname.startsWith('/games/blackjack') ? 'text-yellow-400' : 'text-gray-400 hover:text-white'}`}
          >
            Blackjack
          </Link>
          <Link
            href="/games/slots"
            className={`text-sm font-medium transition-colors ${pathname.startsWith('/games/slots') ? 'text-yellow-400' : 'text-gray-400 hover:text-white'}`}
          >
            Slots
          </Link>
          <Link
            href="/wallet"
            className={`text-sm font-medium transition-colors ${pathname === '/wallet' ? 'text-yellow-400' : 'text-gray-400 hover:text-white'}`}
          >
            Wallet
          </Link>
          {session.user.role === 'ADMIN' && (
            <Link
              href="/admin"
              className={`text-sm font-medium transition-colors ${pathname === '/admin' ? 'text-red-400' : 'text-gray-400 hover:text-red-400'}`}
            >
              Admin
            </Link>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        {session ? (
          <>
            <span className="text-sm text-gray-400">
              {session.user.username ?? session.user.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5 transition-colors"
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link
              href="/register"
              className="btn-gold text-sm px-4 py-2"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
