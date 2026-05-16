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

const LINGER_MS = 2500;
const BOUNCE_MS = 800;

export function VibeFeed({ token, deck }: VibeFeedProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const enterTimesRef = useRef<Map<string, number>>(new Map());
  const reactedRef = useRef<Set<string>>(new Set());
  const [reactedMap, setReactedMap] = useState<Record<string, 'like' | 'dislike'>>({});

  const cursor = useFeed(s => s.cursor);
  const advanceCursor = useFeed(s => s.advanceCursor);
  const recordEvent = useFeed(s => s.recordEvent);

  const handleReact = (cardId: string, reaction: 'like' | 'dislike') => {
    reactedRef.current.add(cardId);
    setReactedMap(prev => ({ ...prev, [cardId]: reaction }));
    const enteredAt = enterTimesRef.current.get(cardId) ?? Date.now();
    const dwellMs = Date.now() - enteredAt;
    recordEvent(cardId, reaction, dwellMs);
  };

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const cardId = el.dataset.cardId;
          if (!cardId) continue;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.75) {
            if (!enterTimesRef.current.has(cardId)) {
              enterTimesRef.current.set(cardId, Date.now());
            }
            const idx = Number(el.dataset.idx);
            if (!Number.isNaN(idx) && idx + 1 > cursor) advanceCursor();
          } else if (entry.intersectionRatio < 0.25) {
            const enteredAt = enterTimesRef.current.get(cardId);
            if (enteredAt !== undefined) {
              const dwellMs = Date.now() - enteredAt;
              enterTimesRef.current.delete(cardId);
              // Only record implicit if user didn't tap explicitly
              if (!reactedRef.current.has(cardId)) {
                if (dwellMs >= LINGER_MS) {
                  recordEvent(cardId, 'lingered', dwellMs);
                } else if (dwellMs < BOUNCE_MS) {
                  recordEvent(cardId, 'bounced', dwellMs);
                }
              }
            }
          }
        }
      },
      { root: node, threshold: [0.25, 0.75] }
    );

    node.querySelectorAll('[data-card-id]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [deck, advanceCursor, cursor, recordEvent]);

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
          <div key={card.cardId} data-card-id={card.cardId} data-idx={i} className="h-full w-full">
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
