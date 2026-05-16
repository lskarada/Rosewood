'use client';
import Image from 'next/image';
import type { VibePair } from '@/lib/types';

interface Props {
  pair: VibePair;
  onChoose: (side: 'a' | 'b') => void;
}

export function VibePairCard({ pair, onChoose }: Props) {
  return (
    <div className="flex flex-col md:flex-row gap-4 w-full max-w-4xl mx-auto">
      {(['a', 'b'] as const).map(side => {
        const v = pair[side];
        return (
          <button
            key={side}
            onClick={() => onChoose(side)}
            className="flex-1 relative aspect-[4/3] md:aspect-[3/4] rounded-2xl overflow-hidden bg-stone-200 active:scale-95 transition"
          >
            <Image
              src={v.image}
              alt={v.label}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-white">
              <div className="text-lg font-medium">{v.label}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
