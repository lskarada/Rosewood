import Image from 'next/image';
import type { GuestBrief } from '@/lib/types';

export function BriefCard({ brief }: { brief: GuestBrief }) {
  const hero = brief.liked[0];
  const rest = brief.liked.slice(1);

  return (
    <article className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl border border-stone-200/60 overflow-hidden">

      {hero ? (
        <div className="relative aspect-[4/3] w-full bg-stone-200">
          <Image
            src={hero.image}
            alt={hero.label}
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-8 pb-6">
            <div className="text-xs uppercase tracking-[0.25em] text-white/70 mb-2">
              Pre-arrival brief · Rosewood Sand Hill
            </div>
            <h2 className="font-serif text-3xl text-white leading-tight max-w-md drop-shadow">
              {brief.oneLine}
            </h2>
          </div>
        </div>
      ) : (
        <header className="px-8 pt-10 pb-6 border-b border-stone-100">
          <div className="text-xs uppercase tracking-[0.25em] text-stone-500">
            {brief.headline}
          </div>
          <h2 className="mt-3 font-serif text-3xl text-stone-900 leading-tight">
            {brief.oneLine}
          </h2>
        </header>
      )}

      {rest.length > 0 ? (
        <section className="px-8 py-7">
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

      {brief.wrapNote ? (
        <section className="px-8 pb-7">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-3">
            In their words
          </div>
          <blockquote className="border-l-2 border-stone-300 pl-5 py-1 font-serif text-lg text-stone-800 italic leading-relaxed">
            &ldquo;{brief.wrapNote}&rdquo;
          </blockquote>
        </section>
      ) : null}

      <section className="px-8 pb-7">
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

      <footer className="px-8 py-6 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
        <div className="text-xs text-stone-400">
          {brief.reactionsCount} reactions
        </div>
        <div className="text-sm font-serif text-stone-700 italic">
          — {brief.signoff}
        </div>
      </footer>
    </article>
  );
}
