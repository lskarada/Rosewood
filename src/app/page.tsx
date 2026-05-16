import Link from 'next/link';

const DEMO_TOKEN = 'demo';

export default function Landing() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-6">
          Rosewood Sand Hill
        </div>
        <h1 className="font-serif text-5xl md:text-6xl tracking-tight max-w-xl leading-tight">
          Your concierge, before you arrive.
        </h1>
        <p className="mt-6 text-stone-400 max-w-md text-lg">
          Thirty seconds. We&apos;ll set the room before you get here.
        </p>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
          <Link
            href={`/survey/${DEMO_TOKEN}/feed`}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 hover:bg-stone-900 hover:border-stone-700 transition-all p-6 text-left"
          >
            <div className="text-3xl">📱</div>
            <div>
              <div className="font-medium text-lg text-stone-100">I&apos;ll scroll</div>
              <div className="text-sm text-stone-400 mt-1">
                Ten vibe shots. Tap the ones that pull you.
              </div>
            </div>
            <div className="mt-auto text-xs text-stone-500 group-hover:text-stone-300 transition-colors">
              30 seconds →
            </div>
          </Link>

          <Link
            href={`/survey/${DEMO_TOKEN}/audio`}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-stone-800 bg-stone-900/50 hover:bg-stone-900 hover:border-stone-700 transition-all p-6 text-left"
          >
            <div className="text-3xl">🎧</div>
            <div>
              <div className="font-medium text-lg text-stone-100">I&apos;ll talk</div>
              <div className="text-sm text-stone-400 mt-1">
                Sky walks you through it. Hands-free, voice only.
              </div>
            </div>
            <div className="mt-auto text-xs text-stone-500 group-hover:text-stone-300 transition-colors">
              60 seconds →
            </div>
          </Link>
        </div>
      </div>
      <footer className="pb-8 text-center text-xs text-stone-600">
        Sky · AI concierge demo
      </footer>
    </main>
  );
}
