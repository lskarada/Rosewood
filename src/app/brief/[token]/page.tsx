'use client';
import { use } from 'react';
import Link from 'next/link';
import { useSurvey } from '@/lib/store';
import { BriefCard } from '@/components/BriefCard';
import { renderBrief } from '@/lib/inference';
import { loadPairs } from '@/lib/content';

export default function Brief({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const state = useSurvey();
  if (state.token !== token) {
    return (
      <main className="min-h-screen bg-stone-50 p-8">
        <div className="max-w-md mx-auto text-stone-500">
          No survey state for this token. <Link href="/" className="underline">Start at the beginning</Link>.
        </div>
      </main>
    );
  }
  const brief = renderBrief({ ...state, isComplete: true }, loadPairs());
  return (
    <main className="min-h-screen bg-stone-50 p-4 md:p-8">
      <BriefCard brief={brief} />
    </main>
  );
}
