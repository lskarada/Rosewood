'use client';
import { use } from 'react';
import Link from 'next/link';
import { useFeed } from '@/lib/store';
import { BriefCard } from '@/components/BriefCard';
import { summarize } from '@/lib/inference';

export default function BriefPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const state = useFeed();

  if (state.token !== token) {
    return (
      <main className="min-h-screen bg-stone-100 flex items-center justify-center p-8">
        <div className="text-center text-stone-500 max-w-md">
          <p>No active session for this token.</p>
          <Link href="/" className="mt-4 inline-block underline text-stone-700">
            Start at the beginning
          </Link>
        </div>
      </main>
    );
  }

  const brief = summarize(state);

  return (
    <main className="min-h-screen bg-stone-100 py-10 px-4 md:px-8">
      <BriefCard brief={brief} />
    </main>
  );
}
