import type { GuestBrief } from '@/lib/types';

// M5 replaces this with the hero-image staff-handoff design.
export function BriefCard({ brief }: { brief: GuestBrief }) {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
      <h2 className="font-serif text-2xl">{brief.headline}</h2>
      <p className="mt-4 text-stone-700">{brief.oneLine}</p>
    </div>
  );
}
