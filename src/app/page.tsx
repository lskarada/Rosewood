import Link from 'next/link';

export default function Landing() {
  const demoToken = 'demo';
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-8">
      <h1 className="text-5xl font-serif tracking-tight">Vibewise</h1>
      <p className="mt-4 text-lg text-stone-600 max-w-md text-center">
        Your concierge will know you before you arrive.
      </p>
      <Link
        href={`/survey/${demoToken}`}
        className="mt-10 px-8 py-4 bg-stone-900 text-white rounded-full text-lg"
      >
        Start the 90-second survey
      </Link>
    </main>
  );
}
