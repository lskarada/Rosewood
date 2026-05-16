export default async function AudioFlow({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="min-h-screen p-8">
      <h2 className="text-2xl">Audio flow — token {token}</h2>
      <p className="mt-2 text-stone-500">stub: ElevenLabs widget lands here in Phase 4</p>
      <a href={`/brief/${token}`} className="mt-6 inline-block underline">
        skip to brief →
      </a>
    </main>
  );
}
