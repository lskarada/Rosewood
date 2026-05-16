'use client';
import { use, useEffect } from 'react';
import { MobileFrame } from '@/components/MobileFrame';
import { VibeFeed } from '@/components/VibeFeed';
import { useFeed } from '@/lib/store';
import { buildDeck } from '@/lib/feed-deck';
import { loadPairs } from '@/lib/content';

export default function FeedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const startSession = useFeed(s => s.startSession);
  const stateToken = useFeed(s => s.token);
  const deck = useFeed(s => s.deck);

  useEffect(() => {
    if (stateToken !== token) {
      startSession(token, buildDeck(token, loadPairs()));
    }
  }, [token, stateToken, startSession]);

  if (stateToken !== token || deck.length === 0) {
    return (
      <MobileFrame>
        <div className="h-full w-full flex items-center justify-center text-stone-500 text-sm">
          Loading…
        </div>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame>
      <VibeFeed token={token} deck={deck} />
    </MobileFrame>
  );
}
