'use client';
import { useEffect, use } from 'react';
import Link from 'next/link';
import { MobileFrame } from '@/components/MobileFrame';

export default function AudioFlow({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? '';

  useEffect(() => {
    if (!document.querySelector('script[src*="elevenlabs"]')) {
      const s = document.createElement('script');
      s.src = 'https://elevenlabs.io/convai-widget/index.js';
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

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

        <div className="px-6 pb-8 flex flex-col items-center gap-3">
          <Link
            href={`/brief/${token}`}
            className="text-xs uppercase tracking-widest text-stone-500 hover:text-stone-300 transition-colors"
          >
            view brief →
          </Link>
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
