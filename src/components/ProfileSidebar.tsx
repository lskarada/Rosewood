'use client';
import { AXES, type ProfileVector } from '@/lib/types';

export function ProfileSidebar({ profile }: { profile: ProfileVector }) {
  return (
    <div className="space-y-2 text-xs">
      {AXES.map(axis => {
        const v = profile[axis];
        const pct = Math.round(((v + 1) / 2) * 100);
        return (
          <div key={axis}>
            <div className="flex justify-between text-stone-500">
              <span>{axis}</span><span>{v >= 0 ? '+' : ''}{v.toFixed(2)}</span>
            </div>
            <div className="h-1 bg-stone-200 rounded">
              <div className="h-full bg-stone-800 rounded" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
