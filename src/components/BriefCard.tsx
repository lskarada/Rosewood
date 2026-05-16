import type { GuestBrief } from '@/lib/types';

export function BriefCard({ brief }: { brief: GuestBrief }) {
  const confidencePct = Math.round(brief.confidence * 100);
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow border border-stone-200 p-8 space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-stone-500">Guest brief · {brief.modality}</div>
        <div className="mt-2 text-2xl font-serif">{brief.oneLine}</div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-stone-500 mb-2">Top axes</div>
        <div className="flex gap-2 flex-wrap">
          {brief.topAxes.map(t => (
            <span key={t.axis} className="px-3 py-1 bg-stone-100 rounded-full text-sm">{t.label}</span>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-stone-500 mb-2">Recommendations</div>
        <ul className="space-y-3">
          {brief.recommendations.map((r, i) => (
            <li key={i} className="border-l-2 border-stone-300 pl-3">
              <div className="font-medium">{r.title}</div>
              <div className="text-sm text-stone-600">{r.blurb}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-xs text-stone-500 border-t pt-3">
        confidence {confidencePct}% · {brief.answeredCount} answers · max streak {brief.maxStreak}
      </div>
    </div>
  );
}
