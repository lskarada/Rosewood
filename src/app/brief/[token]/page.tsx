export default async function Brief({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="min-h-screen p-8">
      <h2 className="text-2xl">Guest brief — token {token}</h2>
      <p className="mt-2 text-stone-500">stub: BriefCard lands here in Phase 2</p>
    </main>
  );
}
