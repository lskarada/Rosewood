import Image from 'next/image';
import type { GuestBrief, Reaction } from '@/lib/types';

const REACTION_BADGE: Record<Reaction, { label: string; cls: string }> = {
  like:     { label: 'liked',    cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  dislike:  { label: 'passed',   cls: 'bg-stone-100 text-stone-700 ring-stone-200' },
  lingered: { label: 'lingered', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  bounced:  { label: 'bounced',  cls: 'bg-stone-50 text-stone-500 ring-stone-200' },
};

const CONFIDENCE_BADGE = {
  high:   { label: 'high confidence',   cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  medium: { label: 'medium confidence', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  low:    { label: 'low confidence',    cls: 'bg-stone-100 text-stone-600 ring-stone-200' },
};

function fmtSeconds(ms: number): string {
  const s = ms / 1000;
  if (s < 1) return `${Math.round(ms)}ms`;
  return `${s.toFixed(1)}s`;
}

export function BriefCard({ brief }: { brief: GuestBrief }) {
  const hero = brief.liked[0];
  const rest = brief.liked.slice(1);
  const conf = CONFIDENCE_BADGE[brief.confidence];

  return (
    <article className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl border border-stone-200/60 overflow-hidden">

      {/* Hero or fallback header */}
      {hero ? (
        <div className="relative aspect-[4/3] w-full bg-stone-200">
          <Image
            src={hero.image}
            alt={hero.label}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-8 pb-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs uppercase tracking-[0.25em] text-white/70">
                Pre-arrival brief · Rosewood Sand Hill
              </span>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ${conf.cls}`}>
                {conf.label}
              </span>
            </div>
            <h2 className="font-serif text-3xl text-white leading-tight max-w-xl drop-shadow">
              {brief.oneLine}
            </h2>
          </div>
        </div>
      ) : (
        <header className="px-8 pt-10 pb-6 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.25em] text-stone-500">
              {brief.headline}
            </span>
            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ${conf.cls}`}>
              {conf.label}
            </span>
          </div>
          <h2 className="mt-3 font-serif text-3xl text-stone-900 leading-tight">
            {brief.oneLine}
          </h2>
        </header>
      )}

      {/* Axis score readout */}
      {brief.axisScores.length > 0 ? (
        <section className="px-8 pt-7 pb-2">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-3">
            Where the signal landed
          </div>
          <div className="space-y-2.5">
            {brief.axisScores.map(({ axis, score, phrase }) => (
              <div key={axis} className="flex items-center gap-4">
                <div className="w-24 flex-none text-xs uppercase tracking-wider text-stone-500">
                  {axis}
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-stone-200 relative overflow-hidden">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-stone-400" />
                  <div
                    className={`absolute inset-y-0 ${score >= 0 ? 'bg-rose-500' : 'bg-stone-700'}`}
                    style={{
                      left: score >= 0 ? '50%' : `${50 + score * 50}%`,
                      width: `${Math.abs(score) * 50}%`,
                    }}
                  />
                </div>
                <div className="w-44 flex-none text-xs text-stone-600 text-right">{phrase}</div>
                <div className="w-12 flex-none text-xs font-mono text-stone-500 text-right">
                  {score > 0 ? '+' : ''}{score.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* What pulled them — also-liked grid */}
      {rest.length > 0 ? (
        <section className="px-8 pt-7 pb-2">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-4">
            What also pulled them
          </div>
          <div className={`grid gap-3 ${rest.length === 1 ? 'grid-cols-1 max-w-xs' : 'grid-cols-2'}`}>
            {rest.map(card => (
              <figure key={card.cardId} className="space-y-2">
                <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden bg-stone-200">
                  <Image
                    src={card.image}
                    alt={card.label}
                    fill
                    sizes="(max-width: 768px) 50vw, 240px"
                    className="object-cover"
                  />
                </div>
                <figcaption className="text-sm font-medium text-stone-700">{card.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* Reasoning trail */}
      {brief.reasoning.length > 0 ? (
        <section className="px-8 pt-7 pb-2">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-3">
            How we read the signal
          </div>
          <ul className="divide-y divide-stone-100">
            {brief.reasoning.map(step => {
              const badge = REACTION_BADGE[step.reaction];
              return (
                <li key={step.cardId} className="flex gap-4 py-3">
                  <div className="relative h-14 w-14 flex-none rounded-lg overflow-hidden bg-stone-200">
                    <Image
                      src={step.image}
                      alt={step.label}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-stone-900 truncate">{step.label}</span>
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ring-1 ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono ml-auto flex-none">
                        {fmtSeconds(step.dwellMs)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-600 leading-relaxed">{step.interpretation}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* In their words */}
      {brief.wrapNote ? (
        <section className="px-8 pt-7 pb-2">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-3">
            In their words
          </div>
          <blockquote className="border-l-2 border-stone-300 pl-5 py-1 font-serif text-lg text-stone-800 italic leading-relaxed">
            &ldquo;{brief.wrapNote}&rdquo;
          </blockquote>
        </section>
      ) : null}

      {/* Recommendations */}
      <section className="px-8 pt-7 pb-2">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-4">
          Where you can act
        </div>
        <ol className="space-y-5">
          {brief.recommendations.map((r, i) => (
            <li key={i} className="flex gap-4">
              <div className="flex-none w-7 h-7 rounded-full bg-stone-900 text-white text-xs font-medium flex items-center justify-center mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium text-stone-900">{r.title}</div>
                <div className="text-sm text-stone-600 mt-1 leading-relaxed">{r.blurb}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Signoff */}
      <footer className="mt-7 px-8 py-6 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
        <div className="text-xs text-stone-400 font-mono">
          {brief.reactionsCount} reactions · {fmtSeconds(brief.totalDwellMs)} total dwell
        </div>
        <div className="text-sm font-serif text-stone-700 italic">
          — {brief.signoff}
        </div>
      </footer>
    </article>
  );
}
