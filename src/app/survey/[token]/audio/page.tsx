'use client';
import { useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MobileFrame } from '@/components/MobileFrame';
import { useFeed } from '@/lib/store';
import { buildDeck } from '@/lib/feed-deck';
import { loadPairs } from '@/lib/content';
import type { Reaction } from '@/lib/types';

// Demo persona seed — voice agent doesn't yet write to the store directly,
// so when the user wraps up we seed a coherent set of events so the brief
// has real signal to display. Picks a "quiet executive on the move" persona.
const VOICE_PERSONA: Array<{ pairId: string; side: 'a' | 'b'; reaction: Reaction; dwellMs: number }> = [
  { pairId: 'pool-vs-cabana',         side: 'b', reaction: 'like',     dwellMs: 3200 },
  { pairId: 'pool-vs-cabana',         side: 'a', reaction: 'dislike',  dwellMs: 1100 },
  { pairId: 'winegarden-vs-maderabar', side: 'b', reaction: 'like',    dwellMs: 4100 },
  { pairId: 'trail-vs-spa',            side: 'b', reaction: 'like',    dwellMs: 2800 },
  { pairId: 'minimal-vs-maximal',      side: 'a', reaction: 'lingered', dwellMs: 3600 },
  { pairId: 'solo-vs-group',           side: 'a', reaction: 'like',    dwellMs: 2500 },
  { pairId: 'city-vs-morning',         side: 'a', reaction: 'like',    dwellMs: 3300 },
];

export default function AudioFlow({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? '';

  const startSession = useFeed(s => s.startSession);
  const recordEvent = useFeed(s => s.recordEvent);
  const complete = useFeed(s => s.complete);
  const setWrapNote = useFeed(s => s.setWrapNote);

  // Inject ElevenLabs widget script
  useEffect(() => {
    if (!document.querySelector('script[src*="elevenlabs"]')) {
      const s = document.createElement('script');
      s.src = 'https://elevenlabs.io/convai-widget/index.js';
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  // Initialize the session so the store has a deck to seed against
  useEffect(() => {
    const deck = buildDeck(token, loadPairs());
    startSession(token, deck);
  }, [token, startSession]);

  const finishAndShowBrief = () => {
    // Map persona to actual cardIds in the loaded pool
    const pool = loadPairs();
    for (const step of VOICE_PERSONA) {
      const pair = pool.find(p => p.id === step.pairId);
      if (!pair) continue;
      const cardId = `${step.pairId}-${step.side}`;
      recordEvent(cardId, step.reaction, step.dwellMs);
    }
    setWrapNote('Coming with my partner — celebrating closing the round. Quiet would be nice.');
    complete();
    router.push(`/brief/${token}`);
  };

  return (
    <MobileFrame>
      <div className="relative flex h-full w-full flex-col bg-gradient-to-b from-stone-900 via-stone-950 to-black text-stone-100">
        <div className="px-6 pt-20 pb-6 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-4">
            Voice intake
          </div>
          <h2 className="font-serif text-3xl text-white leading-tight">
            Sky is on the line.
          </h2>
          <p className="mt-3 text-sm text-stone-400 max-w-xs mx-auto">
            Hit the mic and answer like you&apos;re talking to a person at the front desk.
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center px-6">
          {agentId ? (
            // @ts-expect-error custom element provided by ElevenLabs script
            <elevenlabs-convai
              agent-id={agentId}
              dynamic-variables={JSON.stringify({ token })}
            />
          ) : (
            <div className="max-w-xs text-center bg-stone-900/60 rounded-2xl p-6 border border-stone-800">
              <div className="text-sm text-stone-300">
                ElevenLabs agent isn&apos;t configured. Set <code className="text-stone-100">NEXT_PUBLIC_ELEVENLABS_AGENT_ID</code> in <code>.env</code> and reload.
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-8 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={finishAndShowBrief}
            className="
              w-full max-w-xs rounded-full bg-stone-100 text-stone-900 py-3.5 font-medium text-base
              hover:bg-white transition-colors
            "
          >
            I&apos;m done — show my brief
          </button>
          <Link
            href="/"
            className="text-xs text-stone-600 hover:text-stone-400 transition-colors"
          >
            back to start
          </Link>
        </div>
      </div>
    </MobileFrame>
  );
}
