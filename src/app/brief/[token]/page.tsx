'use client';
import { use } from 'react';
import Link from 'next/link';

// M5 wires this to useFeed + summarize().
export default function BriefPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return (
    <main className="min-h-screen bg-stone-100 p-8">
      <p className="text-stone-500">
        Brief stub for token <code>{token}</code> — M5 will render the real card.
      </p>
      <Link href="/" className="mt-4 inline-block underline text-stone-700">
        Back
      </Link>
    </main>
  );
}
