'use client';
import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useSurvey } from '@/lib/store';
import { VibePairCard } from '@/components/VibePair';
import { StreakBadge } from '@/components/StreakBadge';
import { ProfileSidebar } from '@/components/ProfileSidebar';

export default function VisualFlow({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const { init, currentPair, answer, isComplete, streak, profile, answered } = useSurvey();

  useEffect(() => {
    init(token, 'visual');
  }, [init, token]);

  useEffect(() => {
    if (isComplete) router.push(`/brief/${token}`);
  }, [isComplete, router, token]);

  const pair = currentPair();
  if (!pair) return <main className="p-8">loading…</main>;

  return (
    <main className="min-h-screen bg-stone-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm text-stone-500">pair {answered.length + 1}</div>
          <StreakBadge streak={streak} answered={answered.length} />
        </div>
        <div className="grid md:grid-cols-[1fr_180px] gap-6">
          <VibePairCard pair={pair} onChoose={(side) => answer(side)} />
          <div className="hidden md:block bg-white rounded-xl p-4 border border-stone-200">
            <div className="text-xs uppercase tracking-wide text-stone-500 mb-3">profile (live)</div>
            <ProfileSidebar profile={profile} />
          </div>
        </div>
      </div>
    </main>
  );
}
