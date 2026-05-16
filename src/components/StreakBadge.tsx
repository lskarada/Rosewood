'use client';

export function StreakBadge({ streak, answered }: { streak: number; answered: number }) {
  if (answered < 4) return <div className="text-sm text-stone-400">getting your baseline…</div>;
  if (streak === 0) return <div className="text-sm text-amber-700">huh — recalibrating</div>;
  return (
    <div className="text-sm font-medium text-emerald-700">
      🔥 {streak} in a row · we&apos;re locking your vibe
    </div>
  );
}
