'use client';
import { useEffect, use } from 'react';
import Link from 'next/link';

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
    <main className="min-h-screen bg-stone-50 p-8 flex flex-col items-center">
      <h2 className="text-2xl font-serif mb-2">Sky is on the line</h2>
      <p className="text-sm text-stone-500 mb-8">Token: {token}</p>

      {agentId ? (
        // @ts-expect-error custom element provided by ElevenLabs script
        <elevenlabs-convai
          agent-id={agentId}
          dynamic-variables={JSON.stringify({ token })}
        />
      ) : (
        <div className="max-w-md text-center bg-white rounded-2xl p-6 border border-stone-200 shadow">
          <div className="text-stone-700">
            ElevenLabs agent not yet configured. Set <code className="bg-stone-100 px-1 rounded">NEXT_PUBLIC_ELEVENLABS_AGENT_ID</code> in <code className="bg-stone-100 px-1 rounded">.env.local</code> and reload.
          </div>
          <div className="text-xs text-stone-500 mt-3">See <code>docs/elevenlabs-agent-config.md</code> for dashboard setup.</div>
        </div>
      )}

      <Link href={`/brief/${token}`} className="mt-12 underline text-stone-500">
        view brief →
      </Link>
    </main>
  );
}
