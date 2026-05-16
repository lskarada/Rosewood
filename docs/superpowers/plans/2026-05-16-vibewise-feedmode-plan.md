# Vibewise Feed-Mode Pivot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the paired-choice visual survey with a TikTok-style vertical-feed intake — single full-bleed images, like/dislike + dwell signal, 3-question wrap, mobile-frame on desktop — producing the same warm staff brief but driven by feed reactions instead of forced choices.

**Architecture:** New `FeedState` store + new inference module (`aggregateProfile`, `engagementLevel`, `topLiked`, `topBounced`) replace the predictive-streak engine. New `VibeFeed`/`FeedCard`/`MobileFrame`/`WrapForm` components rendered at new routes `/survey/[token]/feed` and `/survey/[token]/wrap`. The existing `BriefCard` is extended with two new image sections and an "in their words" passthrough. Audio/ElevenLabs path is parked (files untouched, no routing). All work lands on branch `feat/feed-mode` from `main` at HEAD `49ce7c8`.

**Tech Stack:** Next.js 15.5 App Router (TS) · React 19 · Tailwind CSS · Zustand · Vitest · `next/image` with Rosewood CDN remote pattern (already configured).

---

## Spec reference

This plan implements `docs/superpowers/specs/2026-05-16-vibewise-feedmode-design.md`. Section numbers below (e.g. "spec §5.2") refer to that file.

## Repo state assumptions at plan start

- Branch `main` at SHA `49ce7c8` ("Rosewood pivot — branded images, adaptive cues").
- Working tree clean.
- Local commit `20b11fc` (spec doc) ahead of origin; unpushed.
- `pnpm install` already done; `pnpm dev` works; `pnpm test` green.
- `src/content/vibes.json` has 9 pairs × 2 sides = 18 cards, all using Rosewood CDN images already whitelisted in `next.config.mjs`.
- `src/app/survey/[token]/audio/page.tsx` and `src/app/api/voice/agent/route.ts` exist and are not imported by anything else (verified via `grep -l useSurvey src -r` — only `visual/page.tsx`, `brief/[token]/page.tsx`, and `store.ts` reference the store).

---

## Pre-flight

### Task 0: Branch from main

**Files:** none.

- [ ] **Step 1: Confirm clean tree on main at expected SHA**

```bash
git status
git log --oneline -1
```

Expected: branch `main`, working tree clean, HEAD = `49ce7c8` or later (with spec commit `20b11fc` already on top).

- [ ] **Step 2: Cut feature branch**

```bash
git checkout -b feat/feed-mode
git status
```

Expected: switched to a new branch 'feat/feed-mode', clean tree.

- [ ] **Step 3: Verify dev server + tests baseline**

```bash
pnpm test --run
```

Expected: tests pass (the current 15-test suite from the v1 inference module).

---

## Phase 1 — Skeleton (0:00–0:30)

**Goal:** Types extended. Feed deck builder works and is tested. `MobileFrame` shell renders centered phone-shape on desktop / full-bleed on mobile. New `/feed` and `/wrap` routes return 200 with placeholder content. Click-through `/feed → /wrap → /brief` lands placeholder text.

**Gate:** all routes 200; mobile frame visible centered on desktop ≥768px; full-bleed on <768px.

### Task 1: Extend types (additive)

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Append new feed-mode types to `src/lib/types.ts`**

Open `src/lib/types.ts` and append (below the existing `AXIS_GROUPS` constant, do not delete or modify anything above):

```ts
// === Feed-mode types (spec §6) =============================================

export type Reaction = 'like' | 'dislike' | 'lingered' | 'bounced' | 'neutral';

export interface FeedCardRef {
  cardId: string;        // <pair-id>-<a|b>
  pairId: string;
  side: 'a' | 'b';
  axes: Axis[];
  weights: Partial<Record<Axis, number>>;
  image: string;
  label: string;
  audioPrompt: string;
}

export interface CardEvent {
  cardId: string;
  reaction: Reaction;
  dwellMs: number;
  enteredAt: number;
}

export interface WrapAnswers {
  partySize?: string;
  constraints?: string;
  perfectTrip?: string;
}

export interface FeedState {
  token: string;
  deck: FeedCardRef[];   // length 10
  cursor: number;        // 0..deck.length
  events: CardEvent[];
  wrap: WrapAnswers;
  isComplete: boolean;
}

// Extension of GuestBrief for feed-mode renderBrief (spec §6, §11).
// New optional fields — keeps the existing brief type backward compatible.
export interface FeedBriefExtras {
  liked: Array<{ cardId: string; image: string; label: string }>;
  bounced: Array<{ cardId: string; image: string; label: string }>;
  inTheirWords: WrapAnswers;
  engagement: 'high' | 'medium' | 'quick';
}
```

Then modify the existing `GuestBrief` interface to include the extras as optional. Find the block:

```ts
export interface GuestBrief {
  token: string;
  modality: 'audio' | 'visual';
  headline: string;
  ...
  maxStreak: number;
}
```

and add inside the interface (before the closing `}`):

```ts
  // Feed-mode extras (optional so audio path still compiles)
  liked?: Array<{ cardId: string; image: string; label: string }>;
  bounced?: Array<{ cardId: string; image: string; label: string }>;
  inTheirWords?: WrapAnswers;
  engagement?: 'high' | 'medium' | 'quick';
```

- [ ] **Step 2: Type-check passes**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(vibewise): add feed-mode types (Reaction, CardEvent, FeedState)"
```

### Task 2: Feed deck builder

**Files:**
- Create: `src/lib/feed-deck.ts`
- Create: `src/lib/feed-deck.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/feed-deck.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildDeck } from './feed-deck';
import { loadPairs } from './content';

describe('buildDeck', () => {
  const pool = loadPairs();

  it('returns 10 cards', () => {
    const deck = buildDeck('demo', pool);
    expect(deck).toHaveLength(10);
  });

  it('is deterministic for the same token', () => {
    const a = buildDeck('demo', pool);
    const b = buildDeck('demo', pool);
    expect(a.map(c => c.cardId)).toEqual(b.map(c => c.cardId));
  });

  it('differs between tokens', () => {
    const a = buildDeck('alpha', pool);
    const b = buildDeck('bravo', pool);
    expect(a.map(c => c.cardId)).not.toEqual(b.map(c => c.cardId));
  });

  it('does not place two cards from the same pair adjacent', () => {
    const deck = buildDeck('demo', pool);
    for (let i = 1; i < deck.length; i++) {
      expect(deck[i].pairId).not.toBe(deck[i - 1].pairId);
    }
  });

  it('every cardId encodes pair and side', () => {
    const deck = buildDeck('demo', pool);
    for (const card of deck) {
      expect(card.cardId).toBe(`${card.pairId}-${card.side}`);
    }
  });

  it('weights, image, label are copied from the source side', () => {
    const deck = buildDeck('demo', pool);
    const first = deck[0];
    const pair = pool.find(p => p.id === first.pairId)!;
    const side = first.side === 'a' ? pair.a : pair.b;
    expect(first.weights).toEqual(side.weights);
    expect(first.image).toBe(side.image);
    expect(first.label).toBe(side.label);
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
pnpm exec vitest run src/lib/feed-deck.test.ts
```

Expected: `Cannot find module './feed-deck'`.

- [ ] **Step 3: Implement `src/lib/feed-deck.ts`**

```ts
import type { FeedCardRef, VibePair } from './types';

const DECK_SIZE = 10;
const MAX_SHUFFLE_RETRIES = 50;

// FNV-1a 32-bit hash — small, deterministic, no crypto dep
function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Mulberry32 — fast deterministic PRNG seeded from the hash
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function flatten(pool: VibePair[]): FeedCardRef[] {
  const out: FeedCardRef[] = [];
  for (const pair of pool) {
    for (const side of ['a', 'b'] as const) {
      const data = pair[side];
      out.push({
        cardId: `${pair.id}-${side}`,
        pairId: pair.id,
        side,
        axes: pair.axes,
        weights: data.weights,
        image: data.image,
        label: data.label,
        audioPrompt: data.audioPrompt,
      });
    }
  }
  return out;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function noAdjacentPairs(deck: FeedCardRef[]): boolean {
  for (let i = 1; i < deck.length; i++) {
    if (deck[i].pairId === deck[i - 1].pairId) return false;
  }
  return true;
}

export function buildDeck(token: string, pool: VibePair[]): FeedCardRef[] {
  const all = flatten(pool);
  const rng = mulberry32(hashSeed(token));
  let candidate: FeedCardRef[] = [];
  for (let attempt = 0; attempt < MAX_SHUFFLE_RETRIES; attempt++) {
    const shuffled = shuffle(all, rng).slice(0, DECK_SIZE);
    if (noAdjacentPairs(shuffled)) return shuffled;
    candidate = shuffled;
  }
  return candidate; // fallback after retries; not ideal but unblocks
}
```

- [ ] **Step 4: Tests pass**

```bash
pnpm exec vitest run src/lib/feed-deck.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/feed-deck.ts src/lib/feed-deck.test.ts
git commit -m "feat(vibewise): seeded feed-deck builder, 10 cards, no-adjacent-pair constraint"
```

### Task 3: MobileFrame component

**Files:**
- Create: `src/components/MobileFrame.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/MobileFrame.tsx`:

```tsx
import type { ReactNode } from 'react';

interface MobileFrameProps {
  children: ReactNode;
}

/**
 * Phone-shaped frame on desktop (≥768px), full-bleed on mobile (<768px).
 * Spec §4: 390×844 fixed frame centered on dark page background.
 */
export function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div className="min-h-screen bg-stone-950 md:flex md:items-center md:justify-center">
      <div
        className="
          h-screen w-screen overflow-hidden bg-stone-50
          md:h-[844px] md:w-[390px] md:rounded-[44px] md:border md:border-stone-800
          md:shadow-2xl md:overflow-hidden
        "
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check passes**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MobileFrame.tsx
git commit -m "feat(vibewise): MobileFrame — 390x844 phone shell on desktop, full-bleed mobile"
```

### Task 4: Stub `/feed` and `/wrap` routes

**Files:**
- Create: `src/app/survey/[token]/feed/page.tsx`
- Create: `src/app/survey/[token]/wrap/page.tsx`
- Create: `src/components/FeedCard.tsx`
- Create: `src/components/WrapForm.tsx`

- [ ] **Step 1: Create placeholder `FeedCard.tsx`**

```tsx
import Image from 'next/image';
import type { FeedCardRef } from '@/lib/types';

interface FeedCardProps {
  card: FeedCardRef;
}

export function FeedCard({ card }: FeedCardProps) {
  return (
    <div className="relative h-full w-full bg-stone-900">
      <Image
        src={card.image}
        alt={card.label}
        fill
        sizes="390px"
        className="object-cover"
        priority
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
        <div className="text-white text-lg font-serif">{card.label}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create placeholder `WrapForm.tsx`**

```tsx
'use client';
import { useState } from 'react';
import type { WrapAnswers } from '@/lib/types';

interface WrapFormProps {
  onSubmit: (answers: WrapAnswers) => void;
}

export function WrapForm({ onSubmit }: WrapFormProps) {
  const [partySize, setPartySize] = useState('');
  const [constraints, setConstraints] = useState('');
  const [perfectTrip, setPerfectTrip] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          partySize: partySize.trim() || undefined,
          constraints: constraints.trim() || undefined,
          perfectTrip: perfectTrip.trim() || undefined,
        });
      }}
      className="flex h-full w-full flex-col gap-4 overflow-y-auto bg-stone-50 p-6"
    >
      <h2 className="font-serif text-2xl text-stone-900">Three quick things</h2>
      <label className="block">
        <span className="text-sm text-stone-600">Who&apos;s coming with you?</span>
        <input
          type="text"
          value={partySize}
          onChange={(e) => setPartySize(e.target.value)}
          placeholder="solo · couple · family of 4..."
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm text-stone-600">Anything we should know — allergies, mobility, can&apos;t-do&apos;s?</span>
        <textarea
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="text-sm text-stone-600">What would make this trip perfect?</span>
        <textarea
          value={perfectTrip}
          onChange={(e) => setPerfectTrip(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        className="mt-auto rounded-full bg-stone-900 px-6 py-3 text-white"
      >
        Send to my concierge
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create `/feed` route stub**

`src/app/survey/[token]/feed/page.tsx`:

```tsx
'use client';
import { use } from 'react';
import Link from 'next/link';
import { MobileFrame } from '@/components/MobileFrame';
import { FeedCard } from '@/components/FeedCard';
import { buildDeck } from '@/lib/feed-deck';
import { loadPairs } from '@/lib/content';

export default function FeedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const deck = buildDeck(token, loadPairs());

  return (
    <MobileFrame>
      <div className="h-full w-full">
        {/* P1 stub: show only the first card; P2 wires the scroll-snap feed. */}
        <FeedCard card={deck[0]} />
        <Link
          href={`/survey/${token}/wrap`}
          className="absolute right-4 top-4 z-10 rounded-full bg-white/80 px-4 py-2 text-sm"
        >
          skip to wrap →
        </Link>
      </div>
    </MobileFrame>
  );
}
```

- [ ] **Step 4: Create `/wrap` route stub**

`src/app/survey/[token]/wrap/page.tsx`:

```tsx
'use client';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { MobileFrame } from '@/components/MobileFrame';
import { WrapForm } from '@/components/WrapForm';

export default function WrapPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  return (
    <MobileFrame>
      <WrapForm
        onSubmit={() => {
          // P1 stub: just navigate. P3 will write to the store first.
          router.push(`/brief/${token}`);
        }}
      />
    </MobileFrame>
  );
}
```

- [ ] **Step 5: Verify routes render**

```bash
pnpm dev
```

Open in three tabs:
1. `http://localhost:3000/survey/demo/feed` — phone frame centered on dark background (desktop), first vibe image fills the frame, "skip to wrap" pill top-right.
2. `http://localhost:3000/survey/demo/wrap` — three-input form inside frame, "Send to my concierge" button at the bottom.
3. Resize browser below 768px — frame becomes full-viewport, no decoration.

Stop the dev server with Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add src/app/survey/[token]/feed/page.tsx src/app/survey/[token]/wrap/page.tsx src/components/FeedCard.tsx src/components/WrapForm.tsx
git commit -m "feat(vibewise): stub /feed and /wrap routes with MobileFrame + first-card preview"
```

**P1 GATE:** `/feed`, `/wrap`, `/brief/demo` all return 200; mobile frame visible centered on desktop and full-bleed on mobile; `pnpm test` green.

---

## Phase 2 — Reactions, dwell, new inference engine (0:30–1:15)

**Goal:** Old inference engine retired in one coordinated commit (code + tests removed together, suite stays green). New `aggregateProfile` / `engagementLevel` / `topLiked` / `topBounced` shipped with tests. New `FeedStore` replaces `useSurvey`. `FeedCard` wired with heart/X buttons. `VibeFeed` container uses `IntersectionObserver` to capture dwell and dispatches `CardEvent`s.

**Gate:** scrolling through 10 cards produces a 10-event log; mixed reactions produce a non-zero `topAxes`; `pnpm test` green.

### Task 5: Remove predict/streak engine in a single green commit

**Files:**
- Modify: `src/lib/inference.ts`
- Delete sections: `src/lib/inference.test.ts`

The old engine's public functions (`updateProfile`, `predict`, `selectNextPair`, `shouldExit`, `confidence`) are imported by `src/lib/store.ts` and tested in `src/lib/inference.test.ts`. We're rewriting `store.ts` in Task 8 — but to keep the test suite green between tasks, we delete `inference.test.ts`'s related suites in the same commit that removes the functions. `store.ts` will be temporarily broken; Task 8 fixes it.

- [ ] **Step 1: Read current inference test file to know what to delete**

```bash
cat src/lib/inference.test.ts
```

- [ ] **Step 2: Replace `src/lib/inference.test.ts` with a minimal placeholder**

Overwrite the entire file with:

```ts
import { describe, it, expect } from 'vitest';
import { topAxes } from './inference';
import { emptyProfile } from './types';

describe('topAxes', () => {
  it('returns n axes sorted by absolute magnitude', () => {
    const p = emptyProfile();
    p.social = 0.9;
    p.evening = -0.5;
    p.activity = 0.1;
    expect(topAxes(p, 2)).toEqual(['social', 'evening']);
  });

  it('handles empty profile', () => {
    expect(topAxes(emptyProfile(), 3)).toHaveLength(3);
  });
});
```

This keeps `topAxes` coverage (the one function we're preserving). All other suites are replaced by `inference-feed.test.ts` in Tasks 6–7.

- [ ] **Step 3: Strip predict/streak/exit/confidence/selectNextPair from `src/lib/inference.ts`**

Open `src/lib/inference.ts` and delete the following exported functions (entire bodies):
- `updateProfile`
- `predict`
- `score` (private helper, only used by `predict`)
- `coveredGroupsCount` (private helper, only used by `shouldExit`)
- `shouldExit`
- `confidence`
- `selectNextPair`

Also remove unused imports from the top: `AXIS_GROUPS`, `AnsweredPair`, `SurveyState`. Keep `AXES`, `Axis`, `BriefRecommendation`, `GuestBrief`, `ProfileVector`, `VibePair`, `VibeSide` — `renderBrief` still uses them and gets rewritten in Task 12.

After this edit the file should contain ONLY:
- Imports (cleaned up)
- `topAxes`
- `AXIS_LABELS` constant
- `ROOM_CUES` constant
- `LEAD_CUES` constant
- `renderBrief` (still the old body — we rewrite it in Task 12)
- `clamp` helper

Note: `renderBrief` references `state.confidence` and `state.maxStreak` which won't exist on `FeedState` (they're on `SurveyState`). This will be a TypeScript error until Task 12 rewrites `renderBrief`. That's expected and contained — Task 8 (store) and Task 12 (renderBrief) close the loop.

- [ ] **Step 4: Run tests — only the new `topAxes` block + Task 2's feed-deck tests should run**

```bash
pnpm exec vitest run
```

Expected: 8 passes (2 topAxes + 6 feed-deck). Type-check will fail in `inference.ts` and `store.ts` — that's expected through Tasks 6–8.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inference.ts src/lib/inference.test.ts
git commit -m "refactor(vibewise): retire predict/streak engine; keep topAxes only"
```

### Task 6: Implement `aggregateProfile`

**Files:**
- Create: `src/lib/inference-feed.test.ts`
- Modify: `src/lib/inference.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/inference-feed.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { aggregateProfile } from './inference';
import type { FeedCardRef, CardEvent } from './types';

function makeDeck(): FeedCardRef[] {
  return [
    {
      cardId: 'p1-a', pairId: 'p1', side: 'a',
      axes: ['social'], weights: { social: 0.8 },
      image: '', label: 'busy pool', audioPrompt: '',
    },
    {
      cardId: 'p1-b', pairId: 'p1', side: 'b',
      axes: ['social'], weights: { social: -0.8 },
      image: '', label: 'hidden cabana', audioPrompt: '',
    },
    {
      cardId: 'p2-a', pairId: 'p2', side: 'a',
      axes: ['evening'], weights: { evening: 0.7 },
      image: '', label: 'rooftop dj', audioPrompt: '',
    },
  ];
}

describe('aggregateProfile', () => {
  it('returns zero profile on empty events', () => {
    const profile = aggregateProfile([], makeDeck());
    expect(profile.social).toBe(0);
    expect(profile.evening).toBe(0);
  });

  it('like adds +1.0 × weights', () => {
    const events: CardEvent[] = [
      { cardId: 'p1-a', reaction: 'like', dwellMs: 3000, enteredAt: 0 },
    ];
    const profile = aggregateProfile(events, makeDeck());
    expect(profile.social).toBeCloseTo(0.8, 5);
  });

  it('dislike adds -1.0 × weights', () => {
    const events: CardEvent[] = [
      { cardId: 'p1-a', reaction: 'dislike', dwellMs: 1500, enteredAt: 0 },
    ];
    const profile = aggregateProfile(events, makeDeck());
    expect(profile.social).toBeCloseTo(-0.8, 5);
  });

  it('lingered adds +0.4 × weights', () => {
    const events: CardEvent[] = [
      { cardId: 'p1-a', reaction: 'lingered', dwellMs: 3000, enteredAt: 0 },
    ];
    const profile = aggregateProfile(events, makeDeck());
    expect(profile.social).toBeCloseTo(0.32, 5);
  });

  it('bounced adds -0.2 × weights', () => {
    const events: CardEvent[] = [
      { cardId: 'p1-a', reaction: 'bounced', dwellMs: 400, enteredAt: 0 },
    ];
    const profile = aggregateProfile(events, makeDeck());
    expect(profile.social).toBeCloseTo(-0.16, 5);
  });

  it('neutral adds nothing', () => {
    const events: CardEvent[] = [
      { cardId: 'p1-a', reaction: 'neutral', dwellMs: 1500, enteredAt: 0 },
    ];
    const profile = aggregateProfile(events, makeDeck());
    expect(profile.social).toBe(0);
  });

  it('clamps to [-1, 1] per axis', () => {
    const events: CardEvent[] = [
      { cardId: 'p1-a', reaction: 'like', dwellMs: 3000, enteredAt: 0 },
      { cardId: 'p1-a', reaction: 'like', dwellMs: 3000, enteredAt: 1 },
      { cardId: 'p1-a', reaction: 'like', dwellMs: 3000, enteredAt: 2 },
    ];
    const profile = aggregateProfile(events, makeDeck());
    expect(profile.social).toBe(1);
  });

  it('ignores events with unknown cardId', () => {
    const events: CardEvent[] = [
      { cardId: 'ghost', reaction: 'like', dwellMs: 3000, enteredAt: 0 },
    ];
    const profile = aggregateProfile(events, makeDeck());
    expect(profile.social).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, confirm it fails**

```bash
pnpm exec vitest run src/lib/inference-feed.test.ts
```

Expected: `aggregateProfile is not a function` (or import error).

- [ ] **Step 3: Implement `aggregateProfile`**

Append to `src/lib/inference.ts` (above the `clamp` helper):

```ts
import type { CardEvent, FeedCardRef, Reaction } from './types';
import { emptyProfile } from './types';

const REACTION_WEIGHT: Record<Reaction, number> = {
  like:     +1.0,
  lingered: +0.4,
  neutral:   0.0,
  bounced:  -0.2,
  dislike:  -1.0,
};

export function aggregateProfile(events: CardEvent[], deck: FeedCardRef[]): ProfileVector {
  const profile = emptyProfile();
  const byId = new Map(deck.map(c => [c.cardId, c]));
  for (const event of events) {
    const card = byId.get(event.cardId);
    if (!card) continue;
    const multiplier = REACTION_WEIGHT[event.reaction];
    for (const axis of AXES) {
      const w = card.weights[axis];
      if (w === undefined) continue;
      profile[axis] += w * multiplier;
    }
  }
  for (const axis of AXES) {
    profile[axis] = clamp(-1, 1, profile[axis]);
  }
  return profile;
}
```

Make sure the imports at the top of `inference.ts` include `emptyProfile` (it's exported from `./types`).

- [ ] **Step 4: Tests pass**

```bash
pnpm exec vitest run src/lib/inference-feed.test.ts
```

Expected: 8 passes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inference.ts src/lib/inference-feed.test.ts
git commit -m "feat(vibewise): aggregateProfile — reaction-weighted profile sum with clamping"
```

### Task 7: Implement `engagementLevel`, `topLiked`, `topBounced`

**Files:**
- Modify: `src/lib/inference.ts`
- Modify: `src/lib/inference-feed.test.ts`

- [ ] **Step 1: Append tests to `src/lib/inference-feed.test.ts`**

Append (inside the file, after the existing `describe`):

```ts
import { engagementLevel, topLiked, topBounced } from './inference';

describe('engagementLevel', () => {
  const e = (cardId: string, reaction: 'like' | 'dislike' | 'lingered' | 'bounced' | 'neutral'): CardEvent =>
    ({ cardId, reaction, dwellMs: 1000, enteredAt: 0 });

  it('quick on 0 explicit reactions', () => {
    expect(engagementLevel([])).toBe('quick');
    expect(engagementLevel([e('p1-a', 'bounced'), e('p1-b', 'lingered')])).toBe('quick');
  });

  it('medium on 2-4 explicit reactions', () => {
    expect(engagementLevel([e('p1-a', 'like'), e('p1-b', 'dislike')])).toBe('medium');
    expect(engagementLevel([
      e('p1-a', 'like'), e('p1-b', 'dislike'),
      e('p2-a', 'like'), e('p2-b', 'like'),
    ])).toBe('medium');
  });

  it('high on 5+ explicit reactions', () => {
    expect(engagementLevel([
      e('p1-a', 'like'), e('p1-b', 'dislike'),
      e('p2-a', 'like'), e('p2-b', 'like'),
      e('p3-a', 'dislike'),
    ])).toBe('high');
  });
});

describe('topLiked', () => {
  const deck: FeedCardRef[] = [
    { cardId: 'p1-a', pairId: 'p1', side: 'a', axes: ['social'], weights: { social: 0.8 }, image: 'a.jpg', label: 'a', audioPrompt: '' },
    { cardId: 'p1-b', pairId: 'p1', side: 'b', axes: ['social'], weights: { social: -0.5 }, image: 'b.jpg', label: 'b', audioPrompt: '' },
    { cardId: 'p2-a', pairId: 'p2', side: 'a', axes: ['evening'], weights: { evening: 0.3 }, image: 'c.jpg', label: 'c', audioPrompt: '' },
  ];

  it('returns explicit likes first, ranked by weight magnitude', () => {
    const events: CardEvent[] = [
      { cardId: 'p2-a', reaction: 'like', dwellMs: 0, enteredAt: 0 },
      { cardId: 'p1-a', reaction: 'like', dwellMs: 0, enteredAt: 1 },
    ];
    const liked = topLiked(events, deck, 2);
    expect(liked[0].cardId).toBe('p1-a');
    expect(liked[1].cardId).toBe('p2-a');
  });

  it('falls back to lingered when not enough likes', () => {
    const events: CardEvent[] = [
      { cardId: 'p1-a', reaction: 'like', dwellMs: 0, enteredAt: 0 },
      { cardId: 'p2-a', reaction: 'lingered', dwellMs: 0, enteredAt: 1 },
    ];
    const liked = topLiked(events, deck, 2);
    expect(liked).toHaveLength(2);
    expect(liked[0].cardId).toBe('p1-a');
    expect(liked[1].cardId).toBe('p2-a');
  });

  it('respects n cap', () => {
    const events: CardEvent[] = [
      { cardId: 'p1-a', reaction: 'like', dwellMs: 0, enteredAt: 0 },
      { cardId: 'p1-b', reaction: 'like', dwellMs: 0, enteredAt: 1 },
      { cardId: 'p2-a', reaction: 'like', dwellMs: 0, enteredAt: 2 },
    ];
    expect(topLiked(events, deck, 2)).toHaveLength(2);
  });
});

describe('topBounced', () => {
  const deck: FeedCardRef[] = [
    { cardId: 'p1-a', pairId: 'p1', side: 'a', axes: ['social'], weights: { social: 0.8 }, image: 'a.jpg', label: 'a', audioPrompt: '' },
    { cardId: 'p1-b', pairId: 'p1', side: 'b', axes: ['social'], weights: { social: -0.5 }, image: 'b.jpg', label: 'b', audioPrompt: '' },
  ];

  it('returns explicit dislikes first', () => {
    const events: CardEvent[] = [
      { cardId: 'p1-a', reaction: 'bounced', dwellMs: 0, enteredAt: 0 },
      { cardId: 'p1-b', reaction: 'dislike', dwellMs: 0, enteredAt: 1 },
    ];
    const bounced = topBounced(events, deck, 2);
    expect(bounced[0].cardId).toBe('p1-b');
    expect(bounced[1].cardId).toBe('p1-a');
  });

  it('returns empty when no negative reactions', () => {
    const events: CardEvent[] = [
      { cardId: 'p1-a', reaction: 'like', dwellMs: 0, enteredAt: 0 },
    ];
    expect(topBounced(events, deck, 2)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
pnpm exec vitest run src/lib/inference-feed.test.ts
```

Expected: failures on `engagementLevel`, `topLiked`, `topBounced` imports.

- [ ] **Step 3: Implement the three functions**

Append to `src/lib/inference.ts` (above the `clamp` helper):

```ts
export function engagementLevel(events: CardEvent[]): 'high' | 'medium' | 'quick' {
  const explicit = events.filter(e => e.reaction === 'like' || e.reaction === 'dislike').length;
  if (explicit >= 5) return 'high';
  if (explicit >= 2) return 'medium';
  return 'quick';
}

interface RankedCard {
  cardId: string;
  image: string;
  label: string;
}

function maxAbsWeight(card: FeedCardRef): number {
  return Math.max(0, ...Object.values(card.weights).map(v => Math.abs(v ?? 0)));
}

function rankedByReaction(
  events: CardEvent[],
  deck: FeedCardRef[],
  positive: boolean,
  n: number,
): RankedCard[] {
  const explicit = positive ? 'like' : 'dislike';
  const implicit = positive ? 'lingered' : 'bounced';
  const byId = new Map(deck.map(c => [c.cardId, c]));

  const tier = (reaction: Reaction): number => {
    if (reaction === explicit) return 2;
    if (reaction === implicit) return 1;
    return 0;
  };

  const scored = events
    .map(e => {
      const card = byId.get(e.cardId);
      if (!card) return null;
      const t = tier(e.reaction);
      if (t === 0) return null;
      return { card, tier: t, magnitude: maxAbsWeight(card) };
    })
    .filter((x): x is { card: FeedCardRef; tier: number; magnitude: number } => x !== null);

  scored.sort((a, b) => {
    if (b.tier !== a.tier) return b.tier - a.tier;
    return b.magnitude - a.magnitude;
  });

  return scored.slice(0, n).map(({ card }) => ({
    cardId: card.cardId,
    image: card.image,
    label: card.label,
  }));
}

export function topLiked(events: CardEvent[], deck: FeedCardRef[], n: number): RankedCard[] {
  return rankedByReaction(events, deck, true, n);
}

export function topBounced(events: CardEvent[], deck: FeedCardRef[], n: number): RankedCard[] {
  return rankedByReaction(events, deck, false, n);
}
```

- [ ] **Step 4: Tests pass**

```bash
pnpm exec vitest run src/lib/inference-feed.test.ts
```

Expected: all 14 tests pass (8 from Task 6 + 3 engagementLevel + 3 topLiked + 2 topBounced).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inference.ts src/lib/inference-feed.test.ts
git commit -m "feat(vibewise): engagementLevel, topLiked, topBounced with tier+magnitude ranking"
```

### Task 8: Rewrite `store.ts` as `FeedStore`

**Files:**
- Modify (overwrite): `src/lib/store.ts`

- [ ] **Step 1: Overwrite `src/lib/store.ts`**

```ts
'use client';
import { create } from 'zustand';
import type { FeedState, FeedCardRef, CardEvent, WrapAnswers } from './types';

interface Actions {
  startSession: (token: string, deck: FeedCardRef[]) => void;
  recordEvent: (event: CardEvent) => void; // idempotent per cardId
  advanceCursor: () => void;
  submitWrap: (answers: WrapAnswers) => void;
  reset: () => void;
}

type Store = FeedState & Actions;

const EMPTY: FeedState = {
  token: '',
  deck: [],
  cursor: 0,
  events: [],
  wrap: {},
  isComplete: false,
};

export const useFeed = create<Store>((set, get) => ({
  ...EMPTY,

  startSession: (token, deck) => {
    set({ ...EMPTY, token, deck });
  },

  recordEvent: (event) => {
    const state = get();
    // Idempotent per cardId — only the first event for a given card counts.
    if (state.events.some(e => e.cardId === event.cardId)) return;
    set({ events: [...state.events, event] });
  },

  advanceCursor: () => {
    const state = get();
    if (state.cursor < state.deck.length) {
      set({ cursor: state.cursor + 1 });
    }
  },

  submitWrap: (answers) => {
    set({ wrap: answers, isComplete: true });
  },

  reset: () => set(EMPTY),
}));
```

- [ ] **Step 2: Update `src/app/brief/[token]/page.tsx` to read from `useFeed`**

Replace the file contents with:

```tsx
'use client';
import { use } from 'react';
import Link from 'next/link';
import { useFeed } from '@/lib/store';
import { BriefCard } from '@/components/BriefCard';
import { renderBrief } from '@/lib/inference';

export default function Brief({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const state = useFeed();
  if (state.token !== token) {
    return (
      <main className="min-h-screen bg-stone-50 p-8">
        <div className="max-w-md mx-auto text-stone-500">
          No feed state for this token. <Link href="/" className="underline">Start at the beginning</Link>.
        </div>
      </main>
    );
  }
  const brief = renderBrief(state);
  return (
    <main className="min-h-screen bg-stone-50 p-4 md:p-8">
      <BriefCard brief={brief} />
    </main>
  );
}
```

(The `renderBrief` signature change to take just `FeedState` lands in Task 12. Until Task 12, `renderBrief` still expects `(SurveyState, VibePair[])` — this brief page won't type-check yet. That's OK; we're inside a phase, not at a gate.)

- [ ] **Step 3: Update `src/app/survey/[token]/visual/page.tsx`** — temporary stub redirecting users until Task 14 turns it into a 308 redirect

```tsx
'use client';
import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VisualLegacy({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/survey/${token}/feed`);
  }, [router, token]);
  return null;
}
```

This kills the old paired-choice import chain without deleting code we still want to delete in Task 14.

- [ ] **Step 4: Type-check still has 1 known error (renderBrief signature) — confirm it's the only one**

```bash
pnpm exec tsc --noEmit 2>&1 | head -40
```

Expected: errors only in `src/lib/inference.ts` (`renderBrief` body still references `state.maxStreak`, `state.confidence`) and `src/app/brief/[token]/page.tsx` (calls `renderBrief(state)` with one arg). No errors elsewhere.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts src/app/brief/[token]/page.tsx src/app/survey/[token]/visual/page.tsx
git commit -m "refactor(vibewise): FeedStore replaces useSurvey; brief reads feed state; visual redirects"
```

### Task 9: Interactive `FeedCard` with heart/X buttons

**Files:**
- Modify (overwrite): `src/components/FeedCard.tsx`

- [ ] **Step 1: Overwrite `src/components/FeedCard.tsx`**

```tsx
'use client';
import Image from 'next/image';
import type { FeedCardRef, Reaction } from '@/lib/types';

interface FeedCardProps {
  card: FeedCardRef;
  onReact: (reaction: 'like' | 'dislike') => void;
  reacted: 'like' | 'dislike' | null;
  priority?: boolean;
}

export function FeedCard({ card, onReact, reacted, priority }: FeedCardProps) {
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6">
        <div className="max-w-[60%] text-white text-lg font-serif drop-shadow-lg">
          {card.label}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onReact('dislike')}
            aria-label="dislike"
            className={`h-12 w-12 rounded-full border border-white/30 backdrop-blur transition ${
              reacted === 'dislike'
                ? 'bg-stone-700 text-white scale-95'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <span aria-hidden>✕</span>
          </button>
          <button
            type="button"
            onClick={() => onReact('like')}
            aria-label="like"
            className={`h-12 w-12 rounded-full border border-white/30 backdrop-blur transition ${
              reacted === 'like'
                ? 'bg-rose-500 text-white scale-110'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <span aria-hidden>♥</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check the component in isolation**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -i "FeedCard" || echo "no FeedCard errors"
```

Expected: "no FeedCard errors".

- [ ] **Step 3: Commit**

```bash
git add src/components/FeedCard.tsx
git commit -m "feat(vibewise): FeedCard with heart/dislike buttons + reacted-state styling"
```

### Task 10: `VibeFeed` container with scroll-snap + dwell IntersectionObserver

**Files:**
- Create: `src/components/VibeFeed.tsx`
- Modify (overwrite): `src/app/survey/[token]/feed/page.tsx`

- [ ] **Step 1: Create `src/components/VibeFeed.tsx`**

```tsx
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FeedCard } from './FeedCard';
import { useFeed } from '@/lib/store';
import type { FeedCardRef, CardEvent, Reaction } from '@/lib/types';

interface VibeFeedProps {
  token: string;
  deck: FeedCardRef[];
}

// Dwell thresholds — spec §5.2
const LINGER_MS = 2500;
const BOUNCE_MS = 800;

export function VibeFeed({ token, deck }: VibeFeedProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const enterTimesRef = useRef<Map<string, number>>(new Map());
  const reactedRef = useRef<Map<string, 'like' | 'dislike'>>(new Map());
  const [reactedSnapshot, setReactedSnapshot] = useState<Record<string, 'like' | 'dislike'>>({});

  const recordEvent = useFeed(s => s.recordEvent);
  const advanceCursor = useFeed(s => s.advanceCursor);
  const events = useFeed(s => s.events);

  const handleReact = useCallback((cardId: string, reaction: 'like' | 'dislike') => {
    reactedRef.current.set(cardId, reaction);
    setReactedSnapshot(prev => ({ ...prev, [cardId]: reaction }));
    const enteredAt = enterTimesRef.current.get(cardId) ?? Date.now();
    const dwellMs = Date.now() - enteredAt;
    recordEvent({ cardId, reaction, dwellMs, enteredAt });
  }, [recordEvent]);

  const emitImplicit = useCallback((cardId: string, dwellMs: number, enteredAt: number) => {
    // Skip if user already tapped a button — that event already recorded.
    if (reactedRef.current.has(cardId)) return;
    let reaction: Reaction;
    if (dwellMs >= LINGER_MS) reaction = 'lingered';
    else if (dwellMs < BOUNCE_MS) reaction = 'bounced';
    else reaction = 'neutral';
    recordEvent({ cardId, reaction, dwellMs, enteredAt });
  }, [recordEvent]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const cardId = (entry.target as HTMLElement).dataset.cardId;
        if (!cardId) continue;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.75) {
          if (!enterTimesRef.current.has(cardId)) {
            enterTimesRef.current.set(cardId, Date.now());
          }
        } else if (entry.intersectionRatio < 0.25) {
          const enteredAt = enterTimesRef.current.get(cardId);
          if (enteredAt !== undefined) {
            const dwellMs = Date.now() - enteredAt;
            emitImplicit(cardId, dwellMs, enteredAt);
            advanceCursor();
            enterTimesRef.current.delete(cardId);
          }
        }
      }
    }, {
      root: node,
      threshold: [0.25, 0.75],
    });

    const cards = node.querySelectorAll('[data-card-id]');
    cards.forEach(c => observer.observe(c));
    return () => observer.disconnect();
  }, [deck, emitImplicit, advanceCursor]);

  // When all 10 cards have events, advance to /wrap
  useEffect(() => {
    if (events.length >= deck.length && deck.length > 0) {
      router.push(`/survey/${token}/wrap`);
    }
  }, [events.length, deck.length, router, token]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain"
      style={{ WebkitOverflowScrolling: 'touch' as 'touch' }}
    >
      {deck.map((card, i) => (
        <div key={card.cardId} className="h-full w-full">
          <FeedCard
            card={card}
            onReact={(r) => handleReact(card.cardId, r)}
            reacted={reactedSnapshot[card.cardId] ?? null}
            priority={i < 2}
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Overwrite `src/app/survey/[token]/feed/page.tsx`**

```tsx
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
      const built = buildDeck(token, loadPairs());
      startSession(token, built);
    }
  }, [token, stateToken, startSession]);

  if (stateToken !== token || deck.length === 0) {
    return (
      <MobileFrame>
        <div className="flex h-full w-full items-center justify-center text-stone-500">
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
```

- [ ] **Step 3: Manual smoke test**

```bash
pnpm dev
```

Open `http://localhost:3000/survey/demo/feed`:
- Phone frame visible; first card has heart/X buttons.
- Scroll inside the frame — second card snaps into view.
- Tap heart on card 1; card scales up and turns rose-red.
- Scroll past all 10 cards — page auto-navigates to `/wrap`.

Open browser DevTools console while doing this — no errors.

Stop dev server with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add src/components/VibeFeed.tsx src/app/survey/[token]/feed/page.tsx
git commit -m "feat(vibewise): VibeFeed scroll-snap container with dwell IntersectionObserver"
```

**P2 GATE:** Scroll-through 10 cards produces 10 events in the store (verify in React DevTools); mixed reactions (≥1 like + ≥1 dislike) produce non-zero `topAxes` when fed into `aggregateProfile + topAxes`; `pnpm test` shows 16 passes (2 topAxes + 6 feed-deck + 8 aggregateProfile + 3 engagementLevel + 3 topLiked + 2 topBounced = 24, actually).

---

## Phase 3 — Wrap + brief rewrite (1:15–2:00)

**Goal:** `/wrap` submits to store and routes to brief. `renderBrief` rewritten to consume `FeedState` and populate liked/bounced/inTheirWords/engagement. `BriefCard` displays all 6 sections from spec §11.

**Gate:** Full happy path E2E in browser. Brief renders all six sections. "In their words" displays wrap text verbatim. `pnpm test` green.

### Task 11: Wire `/wrap` to store, navigate to brief

**Files:**
- Modify (overwrite): `src/app/survey/[token]/wrap/page.tsx`

- [ ] **Step 1: Overwrite `src/app/survey/[token]/wrap/page.tsx`**

```tsx
'use client';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { MobileFrame } from '@/components/MobileFrame';
import { WrapForm } from '@/components/WrapForm';
import { useFeed } from '@/lib/store';

export default function WrapPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const submitWrap = useFeed(s => s.submitWrap);
  const stateToken = useFeed(s => s.token);

  if (stateToken !== token) {
    return (
      <MobileFrame>
        <div className="flex h-full w-full items-center justify-center p-6 text-center text-stone-500">
          No feed session for this token. Start at the beginning.
        </div>
      </MobileFrame>
    );
  }

  return (
    <MobileFrame>
      <WrapForm
        onSubmit={(answers) => {
          submitWrap(answers);
          router.push(`/brief/${token}`);
        }}
      />
    </MobileFrame>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/survey/[token]/wrap/page.tsx
git commit -m "feat(vibewise): /wrap submits to feed store before routing to brief"
```

### Task 12: Rewrite `renderBrief` for `FeedState`

**Files:**
- Modify: `src/lib/inference.ts`
- Modify: `src/lib/inference-feed.test.ts`

- [ ] **Step 1: Add tests for the new `renderBrief` signature**

Append to `src/lib/inference-feed.test.ts`:

```ts
import { renderBrief } from './inference';
import type { FeedState } from './types';

describe('renderBrief (feed-mode)', () => {
  const deck: FeedCardRef[] = [
    { cardId: 'p1-a', pairId: 'p1', side: 'a', axes: ['social'], weights: { social: 0.8 }, image: 'a.jpg', label: 'busy pool', audioPrompt: '' },
    { cardId: 'p1-b', pairId: 'p1', side: 'b', axes: ['social'], weights: { social: -0.8 }, image: 'b.jpg', label: 'hidden cabana', audioPrompt: '' },
    { cardId: 'p2-a', pairId: 'p2', side: 'a', axes: ['evening'], weights: { evening: 0.7 }, image: 'c.jpg', label: 'rooftop dj', audioPrompt: '' },
  ];

  const baseState: FeedState = {
    token: 'demo',
    deck,
    cursor: deck.length,
    events: [],
    wrap: {},
    isComplete: true,
  };

  it('returns a brief with all required fields', () => {
    const state: FeedState = {
      ...baseState,
      events: [
        { cardId: 'p1-a', reaction: 'like', dwellMs: 2000, enteredAt: 0 },
        { cardId: 'p1-b', reaction: 'dislike', dwellMs: 500, enteredAt: 1 },
        { cardId: 'p2-a', reaction: 'lingered', dwellMs: 3000, enteredAt: 2 },
      ],
      wrap: { partySize: 'couple', perfectTrip: 'a slow weekend' },
    };
    const brief = renderBrief(state);
    expect(brief.token).toBe('demo');
    expect(brief.headline).toContain('Rosewood');
    expect(brief.liked!.length).toBeGreaterThan(0);
    expect(brief.engagement).toBe('medium');
    expect(brief.inTheirWords!.partySize).toBe('couple');
    expect(brief.inTheirWords!.constraints).toBeUndefined();
  });

  it('hides liked/bounced when there is no signal', () => {
    const brief = renderBrief(baseState);
    expect(brief.liked).toEqual([]);
    expect(brief.bounced).toEqual([]);
    expect(brief.engagement).toBe('quick');
  });

  it('passes wrap answers through verbatim', () => {
    const state: FeedState = {
      ...baseState,
      wrap: {
        partySize: 'family of 4',
        constraints: 'no peanuts',
        perfectTrip: 'kids tire out by 9',
      },
    };
    const brief = renderBrief(state);
    expect(brief.inTheirWords).toEqual(state.wrap);
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail (signature still old)**

```bash
pnpm exec vitest run src/lib/inference-feed.test.ts
```

Expected: TypeScript or runtime errors on `renderBrief(state)` (only 1 arg, old signature takes 2).

- [ ] **Step 3: Rewrite `renderBrief` in `src/lib/inference.ts`**

Open `src/lib/inference.ts` and replace the entire existing `renderBrief` function with:

```ts
export function renderBrief(state: FeedState): GuestBrief {
  const profile = aggregateProfile(state.events, state.deck);
  const top = topAxes(profile, 2);
  const human = (a: Axis) => profile[a] >= 0 ? AXIS_LABELS[a][0] : AXIS_LABELS[a][1];
  const sign = (a: Axis) => profile[a] >= 0 ? '+' : '-';

  const liked = topLiked(state.events, state.deck, 3);
  const bounced = topBounced(state.events, state.deck, 2);
  const engagement = engagementLevel(state.events);

  // Greeting — prose grounded in top axes and what the guest liked
  const parts: string[] = ['Quick read from the scroll.'];
  if (top.length >= 2) {
    parts.push(`They lean ${human(top[0])} with a real pull toward ${human(top[1])}.`);
  } else if (top.length === 1) {
    parts.push(`They lean ${human(top[0])}, but the read is thin.`);
  } else {
    parts.push('Profile too quiet to call cleanly.');
  }
  if (liked.length >= 2) {
    parts.push(`Pulled hardest toward the ${liked[0].label} and the ${liked[1].label}.`);
  } else if (liked.length === 1) {
    parts.push(`Strongest pull: the ${liked[0].label}.`);
  }
  const greeting = parts.join(' ');

  // Recommendations — same cue tables as v1
  const recs: BriefRecommendation[] = [];
  if (top[0]) {
    const cue = ROOM_CUES[`${top[0]}${sign(top[0])}`];
    if (cue) recs.push({ title: 'Room', blurb: cue });
  }
  if (top[1]) {
    const cue = ROOM_CUES[`${top[1]}${sign(top[1])}`];
    if (cue) recs.push({ title: 'Pre-arrival touch', blurb: cue });
  }
  for (const axis of AXES) {
    if (Math.abs(profile[axis]) < 0.3) continue;
    if (axis === top[0]) continue;
    const cue = LEAD_CUES[`${axis}${profile[axis] >= 0 ? '+' : '-'}`];
    if (cue) {
      recs.push({ title: 'Lead with', blurb: cue });
      break;
    }
  }
  while (recs.length < 3) {
    recs.push({
      title: 'Open question',
      blurb: 'Feed didn’t catch enough signal here — ask at check-in.',
    });
  }

  // Confidence phrase from engagement chip
  const confidencePhrase = engagement === 'high'
    ? 'Solid read. Move on this with confidence.'
    : engagement === 'medium'
    ? 'Working read. Use this; adjust as you meet them.'
    : 'Quick scroll. Treat this as a starter sketch — fill in at check-in.';

  // Spine for backward compat with BriefCard's existing fallback rendering
  const spine = liked.map(card => ({
    label: card.label,
    vs: '',
    image: card.image,
  }));

  return {
    token: state.token,
    modality: 'visual',
    headline: 'Pre-arrival brief — Rosewood Sand Hill',
    greeting,
    surprise: undefined,
    spine,
    recommendations: recs.slice(0, 3),
    confidencePhrase,
    signoff: '— Sky · your AI concierge at Sand Hill',
    topAxes: top.map(axis => ({ axis, score: profile[axis], label: human(axis) })),
    confidence: engagement === 'high' ? 0.85 : engagement === 'medium' ? 0.6 : 0.3,
    answeredCount: state.events.length,
    maxStreak: 0, // retired
    liked,
    bounced,
    inTheirWords: state.wrap,
    engagement,
  };
}
```

Make sure the imports at the top of `src/lib/inference.ts` include `FeedState` from `./types`.

- [ ] **Step 4: Run all tests**

```bash
pnpm exec vitest run
```

Expected: all tests pass (24 + 3 new renderBrief = 27).

- [ ] **Step 5: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: zero errors. (The `brief/[token]/page.tsx` `renderBrief(state)` call now matches.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/inference.ts src/lib/inference-feed.test.ts
git commit -m "feat(vibewise): renderBrief consumes FeedState; liked/bounced/inTheirWords/engagement"
```

### Task 13: Rewrite `BriefCard` with 6 sections

**Files:**
- Modify (overwrite): `src/components/BriefCard.tsx`

- [ ] **Step 1: Overwrite `src/components/BriefCard.tsx`**

```tsx
import Image from 'next/image';
import type { GuestBrief } from '@/lib/types';

export function BriefCard({ brief }: { brief: GuestBrief }) {
  const engagementChip =
    brief.engagement === 'high' ? { label: 'high engagement', cls: 'bg-emerald-100 text-emerald-800' }
    : brief.engagement === 'medium' ? { label: 'medium engagement', cls: 'bg-amber-100 text-amber-800' }
    : { label: 'quick scroll', cls: 'bg-stone-100 text-stone-700' };

  const liked = brief.liked ?? [];
  const bounced = brief.bounced ?? [];
  const words = brief.inTheirWords ?? {};
  const wordsEntries = [
    words.partySize ? { k: 'Who', v: words.partySize } : null,
    words.constraints ? { k: 'Heads-up', v: words.constraints } : null,
    words.perfectTrip ? { k: 'Perfect trip', v: words.perfectTrip } : null,
  ].filter((x): x is { k: string; v: string } => x !== null);

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">

      {/* §11.1 Header */}
      <div className="px-8 pt-8 pb-5 border-b border-stone-100 flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Guest brief</div>
          <h2 className="mt-1 text-2xl font-serif">{brief.headline}</h2>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs ${engagementChip.cls}`}>
          {engagementChip.label}
        </span>
      </div>

      {/* §11.2 One-line read */}
      <div className="px-8 py-6">
        <p className="text-lg font-serif leading-relaxed text-stone-800">{brief.greeting}</p>
      </div>

      {/* §11.3 What pulled them */}
      {liked.length > 0 ? (
        <div className="px-8 pb-6">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-3">What pulled them</div>
          <div className={`grid gap-3 ${liked.length === 1 ? 'grid-cols-1' : liked.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {liked.map(card => (
              <figure key={card.cardId} className="space-y-2">
                <div className="relative aspect-[4/5] w-full rounded-xl overflow-hidden bg-stone-200">
                  <Image src={card.image} alt={card.label} fill sizes="(max-width: 768px) 33vw, 200px" className="object-cover" />
                </div>
                <figcaption className="text-sm font-medium text-stone-900">{card.label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      {/* §11.4 What they bounced from */}
      {bounced.length > 0 ? (
        <div className="px-8 pb-6">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-3">What they bounced from</div>
          <div className="text-xs text-stone-500 mb-3 italic">Skip these in the welcome amenity.</div>
          <div className="flex gap-3">
            {bounced.map(card => (
              <figure key={card.cardId} className="space-y-1 w-24">
                <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-stone-200 opacity-70">
                  <Image src={card.image} alt={card.label} fill sizes="96px" className="object-cover" />
                </div>
                <figcaption className="text-xs text-stone-600">{card.label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      {/* §11.5 In their words */}
      {wordsEntries.length > 0 ? (
        <div className="px-8 pb-6">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-3">In their words</div>
          <div className="space-y-3">
            {wordsEntries.map(({ k, v }) => (
              <blockquote key={k} className="border-l-2 border-stone-300 pl-4">
                <div className="text-xs text-stone-500">{k}</div>
                <div className="text-sm text-stone-800 italic">&ldquo;{v}&rdquo;</div>
              </blockquote>
            ))}
          </div>
        </div>
      ) : null}

      {/* §11.6 Recommendations */}
      <div className="px-8 pb-6">
        <div className="text-xs uppercase tracking-wide text-stone-500 mb-3">Where you can act</div>
        <ol className="space-y-4">
          {brief.recommendations.map((r, i) => (
            <li key={i} className="flex gap-4">
              <div className="flex-none w-6 h-6 rounded-full bg-stone-900 text-white text-xs flex items-center justify-center mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium text-stone-900">{r.title}</div>
                <div className="text-sm text-stone-600 mt-0.5">{r.blurb}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* §11.7 Signoff */}
      <div className="px-8 py-5 border-t border-stone-100 bg-stone-50">
        <p className="text-sm text-stone-600 italic">{brief.confidencePhrase}</p>
        <div className="mt-4 flex items-end justify-between">
          <div className="text-xs text-stone-400">
            {brief.answeredCount} cards scrolled
          </div>
          <div className="text-sm font-serif text-stone-700">{brief.signoff}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check passes**

```bash
pnpm exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Manual E2E walkthrough**

```bash
pnpm dev
```

Walk through end-to-end at `http://localhost:3000/`:
1. Click "Start the 90-second survey" → modality fork.
2. Click "I have 90 seconds and a screen" → redirects (briefly flashes) to `/feed`.
3. Mobile frame visible; scroll through all 10 cards; tap heart on 2–3, X on 1–2.
4. Feed auto-navigates to `/wrap`.
5. Fill in any/all three fields. Submit.
6. `/brief/<token>` renders all six sections:
   - Header with "Pre-arrival brief — Rosewood Sand Hill" and an engagement chip
   - One-line greeting referencing axis lean and pulled vibes
   - "What pulled them" — up to 3 image thumbs
   - "What they bounced from" — up to 2 small thumbs (only if you disliked/bounced)
   - "In their words" — quoted answers (only fields you filled)
   - "Where you can act" — 3 recommendations
   - Signoff with "Sky · your AI concierge at Sand Hill"

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/BriefCard.tsx
git commit -m "feat(vibewise): BriefCard renders feed-mode sections (liked, bounced, in their words)"
```

**P3 GATE:** Full happy path works in browser. All six brief sections render. `pnpm test` shows ~27 passes. `pnpm exec tsc --noEmit` clean.

---

## Phase 4 — Polish (2:00–2:30)

**Goal:** Progress dots inside the feed frame. Smoother scroll-snap. `/visual` 308 redirect (replacing the client-side useEffect redirect from Task 8).

**Gate:** 30-second screen recording of full happy path with no visible jank or layout shift.

### Task 14: Progress dots + `/visual` 308 redirect

**Files:**
- Create: `src/components/ProgressDots.tsx`
- Modify: `src/components/VibeFeed.tsx`
- Modify (overwrite): `src/app/survey/[token]/visual/page.tsx`

- [ ] **Step 1: Create `src/components/ProgressDots.tsx`**

```tsx
interface ProgressDotsProps {
  total: number;
  filled: number;
}

export function ProgressDots({ total, filled }: ProgressDotsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full transition-colors ${
            i < filled ? 'bg-white' : 'bg-white/30'
          }`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add dots overlay to `src/components/VibeFeed.tsx`**

Find the return block:

```tsx
  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain"
      style={{ WebkitOverflowScrolling: 'touch' as 'touch' }}
    >
```

Replace with:

```tsx
  const cursor = useFeed(s => s.cursor);

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center">
        <ProgressDots total={deck.length} filled={cursor} />
      </div>
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' as 'touch' }}
      >
```

And add a closing `</div>` before the existing final `</div>` (so the structure is `<div relative><dots/><div scroll>...</div></div>`).

Also add the import at the top of the file:

```tsx
import { ProgressDots } from './ProgressDots';
```

- [ ] **Step 3: Convert `src/app/survey/[token]/visual/page.tsx` to a proper redirect**

Overwrite with:

```tsx
import { redirect } from 'next/navigation';

export default async function VisualLegacy({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/survey/${token}/feed`);
}
```

This is a server-side 307 redirect (Next.js default) — faster than the useEffect version.

- [ ] **Step 4: Smoke check — dev server**

```bash
pnpm dev
```

Open `/survey/demo/feed`:
- Progress dots visible at the top of the frame.
- Scrolling fills them in as cards advance.
- Visit `/survey/demo/visual` directly — server redirects to `/feed` before any HTML renders.

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProgressDots.tsx src/components/VibeFeed.tsx src/app/survey/[token]/visual/page.tsx
git commit -m "feat(vibewise): progress dots overlay + server redirect /visual → /feed"
```

**P4 GATE:** Visible polish — dots animate, redirect is instant, full path remains green.

---

## Phase 5 — Ship (2:30–3:00)

**Goal:** Final type-check + test + build green. Branch pushed.

### Task 15: Final verification + push

**Files:** none.

- [ ] **Step 1: Final test run**

```bash
pnpm exec vitest run
```

Expected: all tests pass (~27).

- [ ] **Step 2: Production build**

```bash
pnpm build
```

Expected: build succeeds; routes listed include `/survey/[token]/feed`, `/survey/[token]/wrap`, `/survey/[token]/visual`, `/survey/[token]/audio`, `/brief/[token]`.

- [ ] **Step 3: Audio smoke check (parked-not-broken)**

```bash
pnpm dev
```

Open `http://localhost:3000/survey/demo/audio` — page loads (ElevenLabs widget may not connect, but the page itself renders without runtime errors). Stop dev server.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin feat/feed-mode
```

Expected: branch pushed; URL of the new branch printed.

- [ ] **Step 5: Open PR (manual step, not automated)**

Visit the URL printed by `git push` to open a pull request. PR title: `feat(vibewise): feed-mode pivot — TikTok-style intake replaces paired survey`. Link to the spec doc in the description.

---

## Definition of done (spec §16 — verify before marking the plan complete)

- [ ] Branch `feat/feed-mode` pushed to GitHub
- [ ] `/survey/<token>/feed` renders mobile-frame on desktop, full-bleed on mobile
- [ ] Scrolling 10 cards with mixed interactions produces an event log of length 10
- [ ] `/wrap` collects three optional short-answer responses
- [ ] `/brief/<token>` renders all six sections from spec §11
- [ ] Old `/visual` route redirects to `/feed`
- [ ] Audio route still loads (smoke test in Task 15 step 3)
- [ ] `pnpm test` passes
- [ ] `pnpm build` green
- [ ] One screen recording demonstrating happy path on a phone-shaped viewport (recorded by user after merge)

---

## Self-review notes (for the executing engineer)

A few non-obvious things you'll encounter:

1. **Task 5 leaves the codebase in a known-broken type-check state.** That's intentional — the same commit that removes the predict/streak engine also removes its tests, so the *test suite* stays green. The TypeScript compile is broken in `inference.ts` (`renderBrief` body) and `brief/[token]/page.tsx` (signature mismatch) until Task 12 lands. Don't try to fix it in between.

2. **Idempotent events.** `recordEvent` rejects a second event for the same `cardId`. The flow that depends on this: a user taps "heart" (records `like`), then scrolls past (IntersectionObserver fires, would record `lingered`/`bounced`/`neutral`, but it's rejected). Test in Task 10's smoke check by watching the events array in React DevTools.

3. **The `/feed` page reuses the same Zustand store across navigations.** That's why the brief page can read the events without re-running the inference engine. Zustand's `create` returns a hook that holds module-level state for the lifetime of the tab.

4. **`MobileFrame` uses Tailwind's `md:` prefix to swap between full-bleed and 390×844.** Don't try to make this responsive any other way — the spec's intent is a hard binary at 768px.

5. **Audio page is intentionally not touched.** If you notice the modality fork still routes to `/audio`, leave it. Spec §15 explicitly parks the audio flow.

6. **The `spine` field in `GuestBrief` is preserved** for backward compat with downstream code (notably `preview-brief.ts` if it exists). The new `liked` field carries the real data; `spine` is populated from `liked` in `renderBrief` for transitional compatibility.
