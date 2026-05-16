# Vibewise

A 90-second AI-concierge vibe survey for hotel guests. Two front-ends (voice via ElevenLabs, visual paired-image swipe) feed one inference engine. Output: a one-page guest brief stamped with a confidence score for whoever assigns the room.

## The mechanic

After three baseline answers, the system predicts which side the guest will pick on each subsequent pair. Consecutive correct predictions form a **streak**. The streak isn't a vanity counter — **it is the algorithm**. Higher streak = higher confidence on the brief. Survey exits early when streak ≥ 5, ≥ 7 answers, and all three axis groups (vibe / pace / taste) are covered.

## Try it

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Run the tests

```bash
pnpm test           # 13 inference-engine unit tests
pnpm lint:vibes     # content schema check
pnpm build          # production build
```

## Stack

Next.js 15 (App Router) · Tailwind · Zustand · Vitest · ElevenLabs Conversational Agents · Vercel

## Architecture

- `src/lib/types.ts` — 8-axis profile vector + survey state types
- `src/lib/inference.ts` — predict / updateProfile / selectNextPair / shouldExit / renderBrief (testable, deterministic)
- `src/lib/store.ts` — Zustand client store wiring the visual flow
- `src/app/api/voice/agent/route.ts` — stateless webhook for the ElevenLabs agent (passes full history each call; no server-side session map → safe across Vercel cold starts)
- `src/content/vibes.json` — 9 paired-choice scenes, axis-tagged
- `src/components/` — `VibePair`, `StreakBadge`, `ProfileSidebar`, `BriefCard`

## Docs

- Design spec → `docs/superpowers/specs/2026-05-16-vibewise-design.md`
- Implementation plan → `docs/superpowers/plans/2026-05-16-vibewise-implementation-plan.md`
- ElevenLabs setup → `docs/elevenlabs-agent-config.md`

## Status

Built in 3 hours as a hackathon project. The visual flow is fully working. The audio flow requires you to create an ElevenLabs agent in the dashboard and set `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` in `.env.local` — see `docs/elevenlabs-agent-config.md`.
