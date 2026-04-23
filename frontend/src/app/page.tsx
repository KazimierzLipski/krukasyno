import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 text-center">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-4">
          <span className="text-yellow-400">KRU</span>
          <span className="text-white">KASYNO</span>
        </h1>
        <p className="text-gray-400 text-xl md:text-2xl max-w-xl mx-auto">
          Premium online casino experience — Blackjack, Slots & more
        </p>
      </div>

      {/* CTA */}
      <div className="flex gap-4 flex-wrap justify-center mb-16">
        <Link
          href="/register"
          className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-8 py-3 rounded-lg text-lg transition-colors"
        >
          Play Now
        </Link>
        <Link
          href="/login"
          className="border border-yellow-400 text-yellow-400 hover:bg-yellow-400/10 font-bold px-8 py-3 rounded-lg text-lg transition-colors"
        >
          Sign In
        </Link>
      </div>

      {/* Game Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
        <div className="casino-table p-8 flex flex-col items-center gap-3">
          <span className="text-5xl">🃏</span>
          <h2 className="text-2xl font-bold text-yellow-400">Blackjack</h2>
          <p className="text-gray-300 text-sm">Beat the dealer. Get to 21.</p>
        </div>
        <div className="casino-table p-8 flex flex-col items-center gap-3">
          <span className="text-5xl">🎰</span>
          <h2 className="text-2xl font-bold text-yellow-400">Slots</h2>
          <p className="text-gray-300 text-sm">Spin for up to 50× your bet.</p>
        </div>
      </div>

      {/* Features */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full text-sm text-gray-400">
        {[
          { icon: '🔒', title: 'Secure', desc: 'JWT auth & encrypted sessions' },
          { icon: '⚡', title: 'Fast', desc: 'Redis-powered game state' },
          { icon: '💰', title: 'Free chips', desc: '1,000 chips on sign-up' },
        ].map((f) => (
          <div key={f.title} className="bg-gray-900 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">{f.icon}</div>
            <div className="font-semibold text-white">{f.title}</div>
            <div>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
