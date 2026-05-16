import Link from 'next/link';

export default async function ModalityFork({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-8">
      <h2 className="text-3xl font-serif text-center">How are you taking this?</h2>
      <div className="mt-12 flex flex-col md:flex-row gap-6">
        <Link
          href={`/survey/${token}/audio`}
          className="flex-1 max-w-xs p-8 bg-white rounded-2xl shadow border border-stone-200 hover:shadow-lg text-center"
        >
          <div className="text-5xl">🎧</div>
          <div className="mt-4 font-medium text-xl">I&apos;m on the move</div>
          <div className="mt-2 text-stone-500 text-sm">Voice survey — driving, walking, hands busy</div>
        </Link>
        <Link
          href={`/survey/${token}/visual`}
          className="flex-1 max-w-xs p-8 bg-white rounded-2xl shadow border border-stone-200 hover:shadow-lg text-center"
        >
          <div className="text-5xl">📱</div>
          <div className="mt-4 font-medium text-xl">I have 90 seconds and a screen</div>
          <div className="mt-2 text-stone-500 text-sm">Tap through paired vibe shots</div>
        </Link>
      </div>
    </main>
  );
}
