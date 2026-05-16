'use client';
import Image from 'next/image';
import type { FeedCardRef } from '@/lib/types';

interface FeedCardProps {
  card: FeedCardRef;
  reacted: 'like' | 'dislike' | null;
  onReact: (reaction: 'like' | 'dislike') => void;
  priority?: boolean;
}

export function FeedCard({ card, reacted, onReact, priority }: FeedCardProps) {
  return (
    <div
      className="relative h-full w-full snap-start bg-stone-900"
      data-card-id={card.cardId}
    >
      <Image
        src={card.image}
        alt={card.label}
        fill
        sizes="(max-width: 768px) 100vw, 390px"
        className="object-cover"
        priority={priority}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 via-black/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

      <div className="absolute inset-x-0 bottom-28 px-6">
        <div className="text-white/95 text-2xl font-serif leading-tight drop-shadow-lg">
          {card.label}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-8 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => onReact('dislike')}
          aria-label="not for me"
          className={`
            h-14 w-14 rounded-full backdrop-blur-md border transition-all duration-200 ease-out
            ${reacted === 'dislike'
              ? 'bg-stone-900/80 border-stone-700 text-stone-300 scale-95'
              : 'bg-white/15 border-white/30 text-white hover:bg-white/25 active:scale-95'
            }
          `}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto h-6 w-6">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onReact('like')}
          aria-label="this pulls me"
          className={`
            h-16 w-16 rounded-full backdrop-blur-md border transition-all duration-200 ease-out
            ${reacted === 'like'
              ? 'bg-rose-500 border-rose-300 text-white scale-110 ring-4 ring-rose-300/40'
              : 'bg-white/15 border-white/30 text-white hover:bg-white/25 active:scale-95'
            }
          `}
        >
          <svg viewBox="0 0 24 24" fill={reacted === 'like' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto h-7 w-7">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
