import Link from 'next/link';

export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-8 text-center">
      <div className="text-xs uppercase tracking-widest text-stone-500">
        Vibewise · hotel concierge survey
      </div>
      <h1 className="mt-4 text-5xl md:text-7xl font-serif tracking-tight leading-tight">
        The hotel that learns you<br/>before you arrive.
      </h1>
      <p className="mt-6 text-lg text-stone-600 max-w-xl">
        Ninety seconds. Two ways in — voice or visual. One brief that helps the
        front desk get your room right the first time.
      </p>
      <Link
        href="/survey/demo"
        className="mt-12 px-8 py-4 bg-stone-900 text-white rounded-full text-lg"
      >
        Try it
      </Link>
      <div className="mt-16 text-xs text-stone-400">
        Built in 3 hours · <span className="underline">github.com/lskarada/Rosewood</span>
      </div>
    </main>
  );
}
