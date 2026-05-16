import Image from 'next/image';
import type { GuestBrief } from '@/lib/types';

export function BriefCard({ brief }: { brief: GuestBrief }) {
  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-5 border-b border-stone-100 flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Guest brief</div>
          <h2 className="mt-1 text-2xl font-serif">{brief.headline}</h2>
        </div>
        <div className="text-xs text-stone-400">
          via {brief.modality === 'audio' ? '🎧 voice' : '📱 visual'}
        </div>
      </div>

      {/* Greeting */}
      <div className="px-8 py-6">
        <p className="text-lg font-serif leading-relaxed text-stone-800">
          {brief.greeting}
        </p>
      </div>

      {/* What pulled them — image spine */}
      {brief.spine.length > 0 ? (
        <div className="px-8 pb-6">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-3">
            What pulled them
          </div>
          <div className={`grid gap-3 ${brief.spine.length === 1 ? 'grid-cols-1' : brief.spine.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {brief.spine.map((s, i) => (
              <figure key={i} className="space-y-2">
                <div className="relative aspect-[4/5] w-full rounded-xl overflow-hidden bg-stone-200">
                  {s.image ? (
                    <Image
                      src={s.image}
                      alt={s.label}
                      fill
                      sizes="(max-width: 768px) 33vw, 200px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <figcaption className="text-sm">
                  <div className="font-medium text-stone-900">{s.label}</div>
                  <div className="text-xs text-stone-500">not the {s.vs}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      {/* Surprise callout (optional) */}
      {brief.surprise ? (
        <div className="mx-8 mb-6 p-4 bg-amber-50 border-l-4 border-amber-300 rounded">
          <div className="text-xs uppercase tracking-wide text-amber-800 mb-1">
            One to note
          </div>
          <p className="text-sm text-stone-700 italic">{brief.surprise}</p>
        </div>
      ) : null}

      {/* Recommendations */}
      <div className="px-8 pb-6">
        <div className="text-xs uppercase tracking-wide text-stone-500 mb-3">
          Where you can act
        </div>
        <ol className="space-y-4">
          {brief.recommendations.map((r, i) => (
            <li key={i} className="flex gap-4">
              <div className="flex-none w-6 h-6 rounded-full bg-stone-900 text-white text-xs flex items-center justify-center mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium text-stone-900">{r.title}</div>
                <div className="text-sm text-stone-600 mt-0.5">{r.blurb}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Confidence + signoff */}
      <div className="px-8 py-5 border-t border-stone-100 bg-stone-50">
        <p className="text-sm text-stone-600 italic">{brief.confidencePhrase}</p>
        <div className="mt-4 flex items-end justify-between">
          <div className="text-xs text-stone-400">
            {brief.answeredCount} answers · max streak {brief.maxStreak} · {Math.round(brief.confidence * 100)}% confidence
          </div>
          <div className="text-sm font-serif text-stone-700">{brief.signoff}</div>
        </div>
      </div>
    </div>
  );
}
