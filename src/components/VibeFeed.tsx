'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FeedCard } from './FeedCard';
import { ProgressDots } from './ProgressDots';
import { useFeed } from '@/lib/store';
import type { FeedCardRef } from '@/lib/types';

interface VibeFeedProps {
  token: string;
  deck: FeedCardRef[];
}

export function VibeFeed({ token, deck }: VibeFeedProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reactedMap, setReactedMap] = useState<Record<string, 'like' | 'dislike'>>({});

  const cursor = useFeed(s => s.cursor);
  const advanceCursor = useFeed(s => s.advanceCursor);
  const recordReaction = useFeed(s => s.recordReaction);

  const handleReact = (cardId: string, reaction: 'like' | 'dislike') => {
    setReactedMap(prev => ({ ...prev, [cardId]: reaction }));
    recordReaction(cardId, reaction);
  };

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.75) {
            const idx = Number((entry.target as HTMLElement).dataset.idx);
            if (!Number.isNaN(idx) && idx + 1 > cursor) {
              advanceCursor();
            }
          }
        }
      },
      { root: node, threshold: 0.75 }
    );
    node.querySelectorAll('[data-idx]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [deck, advanceCursor, cursor]);

  const goToWrap = () => router.push(`/survey/${token}/wrap`);

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center">
        <ProgressDots total={deck.length} filled={cursor} />
      </div>

      <div
        ref={scrollRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {deck.map((card, i) => (
          <div key={card.cardId} data-idx={i} className="h-full w-full">
            <FeedCard
              card={card}
              reacted={reactedMap[card.cardId] ?? null}
              onReact={(r) => handleReact(card.cardId, r)}
              priority={i < 2}
            />
          </div>
        ))}

        <div className="relative h-full w-full snap-start bg-gradient-to-br from-stone-900 to-stone-950 flex flex-col items-center justify-center px-8 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-6">
            Almost there
          </div>
          <h2 className="font-serif text-3xl text-white max-w-xs leading-tight">
            One quick thing before we send this to your concierge.
          </h2>
          <button
            type="button"
            onClick={goToWrap}
            className="mt-10 inline-flex items-center gap-3 px-8 py-4 rounded-full bg-stone-100 text-stone-900 font-medium hover:bg-white transition-colors"
          >
            Continue
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
