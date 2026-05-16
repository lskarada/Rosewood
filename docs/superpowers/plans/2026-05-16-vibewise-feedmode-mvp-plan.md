# Vibewise Feed-Mode MVP — Hackathon Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship a hackathon-demo-quality feed-mode pivot of Vibewise in ~100 minutes. Vertical TikTok-style image feed inside a phone-shaped frame, explicit like/dislike taps only (no dwell complexity), one optional wrap textarea, premium-looking staff brief at the end. Design polish > engineering completeness.

**Architecture:** Strip the v1 paired-choice survey path entirely. New `FeedStore` (events + wrap only). New `MobileFrame` / `FeedCard` / `VibeFeed` / `WrapScreen` components built with high design polish. Simplified inference: weighted-sum profile from likes/dislikes, top axis maps to a one-line vibe and 1–2 staff cues from the existing `ROOM_CUES` table. Audio route deleted (not parked) to remove dead links and ambiguity.

**Tech Stack:** Next.js 15.5 (App Router) · React 19 · Tailwind CSS · Zustand · Rosewood Sand Hill CDN images (already configured in `next.config.mjs`).

**Design system (every UI task follows this):**
- **Page background** (outside frame): `bg-stone-950`
- **Frame:** `390×844` on `md:` and up, `rounded-[44px]`, `border border-stone-800/40`, `shadow-2xl`, fake dynamic-island bar at top
- **Frame contents bg:** `bg-stone-100`
- **Headlines:** `font-serif` (uses Tailwind's serif stack)
- **Section labels:** `text-xs uppercase tracking-widest text-stone-500`
- **Like accent:** `rose-500`; **brand:** `stone-900`; **glass:** `bg-white/15 backdrop-blur-md border border-white/25`
- **Transitions:** `transition-all duration-200 ease-out`
- **Spacing:** multiples of 4/6/8

---

## Spec reference

This plan implements a *cut-down* version of `docs/superpowers/specs/2026-05-16-vibewise-feedmode-design.md`. Deviations from the spec are listed at the bottom of this plan. The superseded comprehensive plan at `2026-05-16-vibewise-feedmode-plan.md` is left in repo for reference but not executed.

## Repo state assumptions

- Branch: `feat/feed-mode` (cut from main at SHA `994922d` containing spec + comprehensive plan, after rebase on origin's ElevenLabs env-var commit `3e78821`).
- Working tree clean.
- `pnpm test` baseline: 15 passes (the v1 inference suite — these all get replaced/deleted by this plan).
- `vibes.json`: 9 pairs × 2 sides = 18 cards on Rosewood CDN, already whitelisted in `next.config.mjs`.

---

## Task M1: Foundation — types, store, deck, landing (target: 20 min)

**Files:**
- Overwrite: `src/lib/types.ts`
- Overwrite: `src/lib/store.ts`
- Create: `src/lib/feed-deck.ts`
- Overwrite: `src/lib/inference.ts` (compile-only stub; M5 fills in real logic)
- Delete: `src/lib/inference.test.ts` (replaced by `src/lib/inference-feed.test.ts` in M5)
- Overwrite: `src/app/page.tsx`
- Delete: `src/app/survey/[token]/page.tsx`, `src/app/survey/[token]/visual/page.tsx`, `src/app/survey/[token]/audio/page.tsx`
- Delete: `src/app/api/voice/agent/route.ts`
- Delete: `src/components/VibePair.tsx`, `src/components/StreakBadge.tsx`, `src/components/ProfileSidebar.tsx`
- Delete: `scripts/preview-brief.ts`, `scripts/lint-vibes.ts`, `docs/elevenlabs-agent-config.md` (optional but recommended for cleanliness)

- [ ] **Step 1: Overwrite `src/lib/types.ts`**

```ts
export const AXES = [
  'social', 'evening', 'activity', 'dining',
  'aesthetic', 'format', 'environment', 'chronotype',
] as const;

export type Axis = typeof AXES[number];
export type ProfileVector = Record<Axis, number>;

export interface VibeSide {
  label: string;
  image: string;
  audioPrompt: string;
  weights: Partial<Record<Axis, number>>;
}

export interface VibePair {
  id: string;
  axes: Axis[];
  a: VibeSide;
  b: VibeSide;
}

export type Reaction = 'like' | 'dislike';

export interface FeedCardRef {
  cardId: string;
  pairId: string;
  side: 'a' | 'b';
  axes: Axis[];
  weights: Partial<Record<Axis, number>>;
  image: string;
  label: string;
}

export interface CardEvent {
  cardId: string;
  reaction: Reaction;
  at: number; // epoch ms
}

export interface FeedState {
  token: string;
  deck: FeedCardRef[];
  cursor: number;
  events: CardEvent[];
  wrapNote: string;
  isComplete: boolean;
}

export interface BriefRecommendation {
  title: string;
  blurb: string;
}

export interface GuestBrief {
  token: string;
  headline: string;
  oneLine: string;
  liked: Array<{ cardId: string; image: string; label: string }>;
  recommendations: BriefRecommendation[];
  wrapNote: string;
  signoff: string;
  reactionsCount: number;
}

export function emptyProfile(): ProfileVector {
  return {
    social: 0, evening: 0, activity: 0, dining: 0,
    aesthetic: 0, format: 0, environment: 0, chronotype: 0,
  };
}
```

- [ ] **Step 2: Create `src/lib/feed-deck.ts`**

```ts
import type { FeedCardRef, VibePair } from './types';

const DECK_SIZE = 10;

function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

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
      });
    }
  }
  return out;
}

export function buildDeck(token: string, pool: VibePair[]): FeedCardRef[] {
  const all = flatten(pool);
  const rng = mulberry32(hashSeed(token));
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Best-effort no-adjacent-pair pass: swap any same-pair adjacency forward.
  for (let i = 1; i < shuffled.length; i++) {
    if (shuffled[i].pairId === shuffled[i - 1].pairId) {
      for (let j = i + 1; j < shuffled.length; j++) {
        if (shuffled[j].pairId !== shuffled[i - 1].pairId &&
            (j + 1 >= shuffled.length || shuffled[j + 1].pairId !== shuffled[i].pairId)) {
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          break;
        }
      }
    }
  }
  return shuffled.slice(0, DECK_SIZE);
}
```

- [ ] **Step 3: Overwrite `src/lib/store.ts`**

```ts
'use client';
import { create } from 'zustand';
import type { FeedState, FeedCardRef, CardEvent } from './types';

interface Actions {
  startSession: (token: string, deck: FeedCardRef[]) => void;
  recordReaction: (cardId: string, reaction: 'like' | 'dislike') => void;
  advanceCursor: () => void;
  setWrapNote: (note: string) => void;
  complete: () => void;
  reset: () => void;
}

type Store = FeedState & Actions;

const EMPTY: FeedState = {
  token: '',
  deck: [],
  cursor: 0,
  events: [],
  wrapNote: '',
  isComplete: false,
};

export const useFeed = create<Store>((set, get) => ({
  ...EMPTY,

  startSession: (token, deck) => set({ ...EMPTY, token, deck }),

  recordReaction: (cardId, reaction) => {
    const state = get();
    const filtered = state.events.filter(e => e.cardId !== cardId);
    const event: CardEvent = { cardId, reaction, at: Date.now() };
    set({ events: [...filtered, event] });
  },

  advanceCursor: () => {
    const state = get();
    if (state.cursor < state.deck.length) set({ cursor: state.cursor + 1 });
  },

  setWrapNote: (note) => set({ wrapNote: note }),
  complete: () => set({ isComplete: true }),
  reset: () => set(EMPTY),
}));
```

(Note: `recordReaction` replaces the prior event for the same cardId — lets the user change their mind by tapping the other button.)

- [ ] **Step 4: Overwrite `src/lib/inference.ts` with a compile-only stub**

```ts
import type { FeedState, GuestBrief } from './types';

// Real implementation lands in Task M5.
export function summarize(_state: FeedState): GuestBrief {
  throw new Error('summarize not yet implemented — see Task M5');
}
```

- [ ] **Step 5: Delete obsolete files**

```bash
rm src/lib/inference.test.ts
rm src/app/survey/[token]/page.tsx
rm src/app/survey/[token]/visual/page.tsx
rm src/app/survey/[token]/audio/page.tsx
rm src/app/api/voice/agent/route.ts
rm src/components/VibePair.tsx
rm src/components/StreakBadge.tsx
rm src/components/ProfileSidebar.tsx
rm scripts/preview-brief.ts
rm scripts/lint-vibes.ts
rm docs/elevenlabs-agent-config.md
rmdir scripts 2>/dev/null || true
```

(The empty `audio`/`visual` parent dirs in `src/app/survey/[token]/` will be created later for `feed` and `wrap` and don't need cleanup now.)

- [ ] **Step 6: Overwrite `src/app/page.tsx` (landing)**

```tsx
import Link from 'next/link';

const DEMO_TOKEN = 'demo';

export default function Landing() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-6">
          Rosewood Sand Hill
        </div>
        <h1 className="font-serif text-5xl md:text-6xl tracking-tight max-w-xl">
          Your concierge, before you arrive.
        </h1>
        <p className="mt-6 text-stone-400 max-w-md text-lg">
          Thirty seconds. Ten images. We&apos;ll set the room before you get here.
        </p>
        <Link
          href={`/survey/${DEMO_TOKEN}/feed`}
          className="mt-12 inline-flex items-center gap-3 px-8 py-4 rounded-full bg-stone-100 text-stone-900 font-medium text-base hover:bg-white transition-colors"
        >
          Begin
          <span aria-hidden>→</span>
        </Link>
      </div>
      <footer className="pb-8 text-center text-xs text-stone-600">
        Sky · AI concierge demo
      </footer>
    </main>
  );
}
```

- [ ] **Step 7: Verify type-check + build**

```bash
pnpm exec tsc --noEmit
```

Expected: zero errors. If `useSurvey` import errors appear from `brief/[token]/page.tsx`, leave them — M5 rewrites that file. Confirm those are the only errors and that they're scoped to the brief page and (stub) `summarize` callsite if any.

If the brief page errors are the only ones, that's expected and acceptable; record them in your report.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(vibewise): MVP foundation — feed types, deck, store; delete v1 survey"
```

---

## Task M2: MobileFrame + FeedCard (target: 25 min) — design polish task

**Files:**
- Create: `src/components/MobileFrame.tsx`
- Create: `src/components/FeedCard.tsx`

This is the most visible task in the demo — invest in polish.

- [ ] **Step 1: Create `src/components/MobileFrame.tsx`**

```tsx
import type { ReactNode } from 'react';

interface MobileFrameProps {
  children: ReactNode;
}

/**
 * Phone-shaped frame on desktop (md+), full-bleed on mobile.
 * Includes faux dynamic-island bar for hackathon polish.
 */
export function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div className="min-h-screen bg-stone-950 md:flex md:items-center md:justify-center md:p-8">
      <div className="
        relative h-screen w-screen overflow-hidden bg-stone-100
        md:h-[844px] md:w-[390px]
        md:rounded-[44px] md:border md:border-stone-800/40
        md:shadow-[0_60px_120px_-20px_rgba(0,0,0,0.6),0_30px_60px_-30px_rgba(0,0,0,0.5)]
      ">
        {/* Dynamic island — desktop only */}
        <div className="hidden md:block absolute top-2 left-1/2 -translate-x-1/2 z-30 h-7 w-28 rounded-full bg-stone-950" />
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/FeedCard.tsx`**

```tsx
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

      {/* Top scrim — gives the dynamic-island room to breathe */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 via-black/20 to-transparent" />

      {/* Bottom scrim — anchors label + buttons */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

      {/* Label */}
      <div className="absolute inset-x-0 bottom-28 px-6">
        <div className="text-white/95 text-2xl font-serif leading-tight drop-shadow-lg">
          {card.label}
        </div>
      </div>

      {/* Reaction buttons */}
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
```

- [ ] **Step 3: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: same brief-page errors as before (M5 fixes), no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/MobileFrame.tsx src/components/FeedCard.tsx
git commit -m "feat(vibewise): MobileFrame with dynamic-island + polished FeedCard with glass buttons"
```

---

## Task M3: VibeFeed + /feed route (target: 15 min)

**Files:**
- Create: `src/components/VibeFeed.tsx`
- Create: `src/components/ProgressDots.tsx`
- Create: `src/app/survey/[token]/feed/page.tsx`

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
          className={`
            h-1 rounded-full transition-all duration-300
            ${i < filled ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}
          `}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/VibeFeed.tsx`**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FeedCard } from './FeedCard';
import { ProgressDots } from './ProgressDots';
import { useFeed } from '@/lib/store';
import type { FeedCardRef } from '@/lib/types';

interface VibeFeedProps {
  token: string;
  deck: FeedCardRef[];
}

export function VibeFeed({ token, deck }: VibeFeedProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reactedMap, setReactedMap] = useState<Record<string, 'like' | 'dislike'>>({});

  const cursor = useFeed(s => s.cursor);
  const advanceCursor = useFeed(s => s.advanceCursor);
  const recordReaction = useFeed(s => s.recordReaction);

  const handleReact = (cardId: string, reaction: 'like' | 'dislike') => {
    setReactedMap(prev => ({ ...prev, [cardId]: reaction }));
    recordReaction(cardId, reaction);
  };

  // Advance cursor as cards scroll into view
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.75) {
            const idx = Number((entry.target as HTMLElement).dataset.idx);
            if (!Number.isNaN(idx) && idx + 1 > cursor) {
              advanceCursor();
            }
          }
        }
      },
      { root: node, threshold: 0.75 }
    );
    node.querySelectorAll('[data-idx]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [deck, advanceCursor, cursor]);

  const goToWrap = () => router.push(`/survey/${token}/wrap`);

  return (
    <div className="relative h-full w-full">
      {/* Progress dots — overlaid below the dynamic island */}
      <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center">
        <ProgressDots total={deck.length} filled={cursor} />
      </div>

      {/* Scroll-snap feed */}
      <div
        ref={scrollRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {deck.map((card, i) => (
          <div key={card.cardId} data-idx={i} className="h-full w-full">
            <FeedCard
              card={card}
              reacted={reactedMap[card.cardId] ?? null}
              onReact={(r) => handleReact(card.cardId, r)}
              priority={i < 2}
            />
          </div>
        ))}

        {/* Wrap CTA card at the end — kicks off /wrap */}
        <div className="relative h-full w-full snap-start bg-gradient-to-br from-stone-900 to-stone-950 flex flex-col items-center justify-center px-8 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-6">
            Almost there
          </div>
          <h2 className="font-serif text-3xl text-white max-w-xs">
            One quick thing before we send this to your concierge.
          </h2>
          <button
            type="button"
            onClick={goToWrap}
            className="mt-10 inline-flex items-center gap-3 px-8 py-4 rounded-full bg-stone-100 text-stone-900 font-medium hover:bg-white transition-colors"
          >
            Continue
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add scrollbar-hide utility to `src/app/globals.css`**

Append to `src/app/globals.css`:

```css
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

- [ ] **Step 4: Create `src/app/survey/[token]/feed/page.tsx`**

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
```

- [ ] **Step 5: Smoke test**

```bash
pnpm dev
```

Visit `http://localhost:3000/survey/demo/feed` on a desktop browser. Verify:
- Phone frame appears centered on dark page bg.
- Dynamic island visible.
- First card image loads.
- Tap heart → fills rose, scales up.
- Scroll → second card snaps; progress dots advance.
- Scroll past all 10 → "Almost there" screen with "Continue" button.

Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/VibeFeed.tsx src/components/ProgressDots.tsx src/app/survey/[token]/feed/page.tsx src/app/globals.css
git commit -m "feat(vibewise): VibeFeed with scroll-snap, progress dots, in-feed wrap CTA"
```

---

## Task M4: WrapScreen + /wrap route (target: 10 min)

**Files:**
- Create: `src/components/WrapScreen.tsx`
- Create: `src/app/survey/[token]/wrap/page.tsx`

- [ ] **Step 1: Create `src/components/WrapScreen.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFeed } from '@/lib/store';

interface WrapScreenProps {
  token: string;
}

export function WrapScreen({ token }: WrapScreenProps) {
  const router = useRouter();
  const setWrapNote = useFeed(s => s.setWrapNote);
  const complete = useFeed(s => s.complete);
  const [note, setNote] = useState('');

  const submit = () => {
    setWrapNote(note.trim());
    complete();
    router.push(`/brief/${token}`);
  };

  return (
    <div className="flex h-full w-full flex-col px-6 pt-20 pb-8 bg-stone-100">
      <div className="text-xs uppercase tracking-[0.3em] text-stone-500 mb-6">
        One last thing
      </div>
      <h2 className="font-serif text-3xl text-stone-900 leading-tight">
        Anything we should know about this trip?
      </h2>
      <p className="mt-3 text-sm text-stone-600">
        Allergies, celebrations, who you&apos;re traveling with, what you&apos;re here to do — anything at all. Or skip.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={6}
        placeholder="Optional…"
        className="
          mt-6 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3
          text-stone-900 placeholder:text-stone-400 text-base
          focus:outline-none focus:ring-2 focus:ring-stone-900/20 focus:border-stone-400
          resize-none
        "
      />
      <button
        type="button"
        onClick={submit}
        className="
          mt-auto w-full rounded-full bg-stone-900 text-white py-4 font-medium text-base
          hover:bg-stone-800 transition-colors
        "
      >
        Send to my concierge
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/survey/[token]/wrap/page.tsx`**

```tsx
'use client';
import { use } from 'react';
import { MobileFrame } from '@/components/MobileFrame';
import { WrapScreen } from '@/components/WrapScreen';

export default function WrapPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return (
    <MobileFrame>
      <WrapScreen token={token} />
    </MobileFrame>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/WrapScreen.tsx src/app/survey/[token]/wrap/page.tsx
git commit -m "feat(vibewise): WrapScreen with single optional textarea + send CTA"
```

---

## Task M5: Real inference + premium BriefCard (target: 25 min)

**Files:**
- Overwrite: `src/lib/inference.ts`
- Overwrite: `src/components/BriefCard.tsx`
- Overwrite: `src/app/brief/[token]/page.tsx`

- [ ] **Step 1: Overwrite `src/lib/inference.ts`**

```ts
import {
  AXES, type Axis, type BriefRecommendation, type FeedState,
  type GuestBrief,
} from './types';

const REACTION_WEIGHT = { like: 1, dislike: -1 } as const;

function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v));
}

function aggregateProfile(state: FeedState): Record<Axis, number> {
  const byId = new Map(state.deck.map(c => [c.cardId, c]));
  const profile: Record<Axis, number> = {
    social: 0, evening: 0, activity: 0, dining: 0,
    aesthetic: 0, format: 0, environment: 0, chronotype: 0,
  };
  for (const event of state.events) {
    const card = byId.get(event.cardId);
    if (!card) continue;
    const mult = REACTION_WEIGHT[event.reaction];
    for (const axis of AXES) {
      const w = card.weights[axis];
      if (w !== undefined) profile[axis] += w * mult;
    }
  }
  for (const axis of AXES) profile[axis] = clamp(-1, 1, profile[axis]);
  return profile;
}

const AXIS_PHRASE: Record<Axis, [string, string]> = {
  social:      ['drawn to energy and people',         'craving quiet and privacy'],
  evening:     ['late-evening, low-light',            'early-evening, fireside'],
  activity:    ['mornings outside, moving',           'mornings inside, recovering'],
  dining:      ['on-property dining',                 'off-property exploration'],
  aesthetic:   ['minimal and clean',                  'layered and warm'],
  format:      ['communal moments',                   'solo time'],
  environment: ['open and elemental',                 'enclosed and grounded'],
  chronotype:  ['night-owl',                          'early-riser'],
};

const ROOM_CUES: Record<string, string> = {
  'social+':       'West Wing facing the pool — energy nearby, easy to find people.',
  'social-':       'East Wing top floor, oak-hillside view. Privacy comes first.',
  'evening+':      'Wine Garden open until 11. Pre-clear late check-in.',
  'evening-':      'Madera fireplace nook reserved for 7pm. Heavy drapes confirmed.',
  'activity+':     'Sand Hill loop trail map + chilled water bottle at the door.',
  'activity-':     'Asaya booking pre-pencilled. Robe and slippers laid out.',
  'dining+':       'Welcome amenity: bottle of the Madera-pairing red.',
  'dining-':       'Welcome amenity: Menlo Park dining map, three names circled.',
  'aesthetic+':    'Premier Vineyard room — clean palette, single orchid. Skip the fruit basket.',
  'aesthetic-':    'Luxury Suite — layered linens, leather-bound books, deeper wood.',
  'format+':       'Mention the Wine Garden Sunday tasting at check-in.',
  'format-':       'No welcome reception. Email-only intro, room set up quietly.',
  'environment+':  'Oak-hillside-facing room with the private deck.',
  'environment-':  'Inner courtyard cottage. Quieter, more contained.',
  'chronotype+':   '24-hour Madera bar menu in the room. Do not ring before 11am.',
  'chronotype-':   'Coffee station stocked by 6:30am. WSJ at the door.',
};

function topAxes(profile: Record<Axis, number>, n: number): Axis[] {
  return [...AXES]
    .filter(a => Math.abs(profile[a]) > 0.05)
    .sort((x, y) => Math.abs(profile[y]) - Math.abs(profile[x]))
    .slice(0, n);
}

export function summarize(state: FeedState): GuestBrief {
  const profile = aggregateProfile(state);
  const top = topAxes(profile, 2);
  const sign = (a: Axis) => profile[a] >= 0 ? '+' : '-';
  const phrase = (a: Axis) =>
    profile[a] >= 0 ? AXIS_PHRASE[a][0] : AXIS_PHRASE[a][1];

  const liked = state.events
    .filter(e => e.reaction === 'like')
    .map(e => state.deck.find(c => c.cardId === e.cardId))
    .filter((c): c is NonNullable<typeof c> => c !== undefined)
    .slice(0, 3)
    .map(card => ({ cardId: card.cardId, image: card.image, label: card.label }));

  let oneLine: string;
  if (top.length === 0) {
    oneLine = 'Light signal from the scroll — treat this as a starter sketch.';
  } else if (top.length === 1) {
    oneLine = `Reading them as ${phrase(top[0])}.`;
  } else {
    oneLine = `Reading them as ${phrase(top[0])}, with a real pull toward being ${phrase(top[1])}.`;
  }

  const recs: BriefRecommendation[] = [];
  if (top[0]) {
    const cue = ROOM_CUES[`${top[0]}${sign(top[0])}`];
    if (cue) recs.push({ title: 'Set the room', blurb: cue });
  }
  if (top[1]) {
    const cue = ROOM_CUES[`${top[1]}${sign(top[1])}`];
    if (cue) recs.push({ title: 'Pre-arrival touch', blurb: cue });
  }
  if (recs.length === 0) {
    recs.push({
      title: 'Open question',
      blurb: 'Not enough signal yet — ask them at check-in.',
    });
  }

  return {
    token: state.token,
    headline: 'Pre-arrival brief — Rosewood Sand Hill',
    oneLine,
    liked,
    recommendations: recs,
    wrapNote: state.wrapNote,
    signoff: 'Sky · your AI concierge at Sand Hill',
    reactionsCount: state.events.length,
  };
}
```

- [ ] **Step 2: Overwrite `src/components/BriefCard.tsx`**

```tsx
import Image from 'next/image';
import type { GuestBrief } from '@/lib/types';

export function BriefCard({ brief }: { brief: GuestBrief }) {
  const hero = brief.liked[0];
  const rest = brief.liked.slice(1);

  return (
    <article className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl border border-stone-200/60 overflow-hidden">

      {/* Hero image (the #1 like) */}
      {hero ? (
        <div className="relative aspect-[4/3] w-full bg-stone-200">
          <Image
            src={hero.image}
            alt={hero.label}
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-8 pb-6">
            <div className="text-xs uppercase tracking-[0.25em] text-white/70 mb-2">
              Pre-arrival brief · Rosewood Sand Hill
            </div>
            <h2 className="font-serif text-3xl text-white leading-tight max-w-md drop-shadow">
              {brief.oneLine}
            </h2>
          </div>
        </div>
      ) : (
        <header className="px-8 pt-10 pb-6 border-b border-stone-100">
          <div className="text-xs uppercase tracking-[0.25em] text-stone-500">
            {brief.headline}
          </div>
          <h2 className="mt-3 font-serif text-3xl text-stone-900 leading-tight">
            {brief.oneLine}
          </h2>
        </header>
      )}

      {/* Liked image grid (rest after hero) */}
      {rest.length > 0 ? (
        <section className="px-8 py-7">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-4">
            What also pulled them
          </div>
          <div className={`grid gap-3 ${rest.length === 1 ? 'grid-cols-1 max-w-xs' : 'grid-cols-2'}`}>
            {rest.map(card => (
              <figure key={card.cardId} className="space-y-2">
                <div className="relative aspect-[4/5] w-full rounded-2xl overflow-hidden bg-stone-200">
                  <Image
                    src={card.image}
                    alt={card.label}
                    fill
                    sizes="(max-width: 768px) 50vw, 240px"
                    className="object-cover"
                  />
                </div>
                <figcaption className="text-sm font-medium text-stone-700">{card.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* In their words */}
      {brief.wrapNote ? (
        <section className="px-8 pb-7">
          <div className="text-xs uppercase tracking-widest text-stone-500 mb-3">
            In their words
          </div>
          <blockquote className="border-l-2 border-stone-300 pl-5 py-1 font-serif text-lg text-stone-800 italic leading-relaxed">
            &ldquo;{brief.wrapNote}&rdquo;
          </blockquote>
        </section>
      ) : null}

      {/* Recommendations */}
      <section className="px-8 pb-7">
        <div className="text-xs uppercase tracking-widest text-stone-500 mb-4">
          Where you can act
        </div>
        <ol className="space-y-5">
          {brief.recommendations.map((r, i) => (
            <li key={i} className="flex gap-4">
              <div className="flex-none w-7 h-7 rounded-full bg-stone-900 text-white text-xs font-medium flex items-center justify-center mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium text-stone-900">{r.title}</div>
                <div className="text-sm text-stone-600 mt-1 leading-relaxed">{r.blurb}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Signoff */}
      <footer className="px-8 py-6 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
        <div className="text-xs text-stone-400">
          {brief.reactionsCount} reactions
        </div>
        <div className="text-sm font-serif text-stone-700 italic">
          — {brief.signoff}
        </div>
      </footer>
    </article>
  );
}
```

- [ ] **Step 3: Overwrite `src/app/brief/[token]/page.tsx`**

```tsx
'use client';
import { use } from 'react';
import Link from 'next/link';
import { useFeed } from '@/lib/store';
import { BriefCard } from '@/components/BriefCard';
import { summarize } from '@/lib/inference';

export default function BriefPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const state = useFeed();

  if (state.token !== token) {
    return (
      <main className="min-h-screen bg-stone-100 flex items-center justify-center p-8">
        <div className="text-center text-stone-500 max-w-md">
          <p>No active session for this token.</p>
          <Link href="/" className="mt-4 inline-block underline text-stone-700">
            Start at the beginning
          </Link>
        </div>
      </main>
    );
  }

  const brief = summarize(state);

  return (
    <main className="min-h-screen bg-stone-100 py-10 px-4 md:px-8">
      <BriefCard brief={brief} />
    </main>
  );
}
```

- [ ] **Step 4: Verify**

```bash
pnpm exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/inference.ts src/components/BriefCard.tsx src/app/brief/[token]/page.tsx
git commit -m "feat(vibewise): summarize() + hero-image BriefCard — staff handoff design"
```

---

## Task M6: Final polish + ship (target: 10 min)

**Files:**
- Modify (small): `src/app/layout.tsx` (favicon/title tweak optional)
- Modify (small): `next.config.mjs` (verify Rosewood CDN still whitelisted)
- Modify: `README.md` (one-paragraph rewrite for the demo URL)

- [ ] **Step 1: Verify production build**

```bash
pnpm build
```

Expected: build succeeds; routes listed: `/`, `/survey/[token]/feed`, `/survey/[token]/wrap`, `/brief/[token]`.

- [ ] **Step 2: Full happy-path manual walkthrough**

```bash
pnpm dev
```

Open `http://localhost:3000/` in Chrome at desktop width.

1. Landing renders dark with "Begin" CTA — typography looks premium.
2. Click "Begin" → land on `/survey/demo/feed` — phone frame centered with dynamic island, first vibe image full-bleed inside.
3. Heart 3 cards, X 1 card, neutral-scroll 6.
4. After the 10th card, "Almost there" snap-screen shows; tap "Continue".
5. `/wrap` — single textarea, write "celebrating 10 years married" or similar. Tap "Send to my concierge".
6. `/brief/demo` — hero image of the top-liked card with white serif headline overlaid; below: 2 secondary like thumbs in a grid, "In their words" blockquote, 2 recommendations, signoff.

Now resize the browser below 768px (or use DevTools device mode). Verify:
- Landing still readable.
- Feed runs full-viewport, no frame decoration.
- Brief card stacks cleanly.

Stop dev server.

- [ ] **Step 3: Update README (one paragraph)**

Overwrite `README.md` with:

```markdown
# Vibewise

A thirty-second concierge intake for Rosewood Sand Hill. Guests scroll ten vibe images, tap the ones that pull them, and the hotel staff gets a warm pre-arrival brief — what to set in the room, what to skip, and the guest's own words about the trip.

Built for a Stanford hackathon, May 2026.

## Stack

Next.js 15.5 (App Router) · React 19 · Tailwind CSS · Zustand. Images served from the Rosewood CDN. No backend, no database — the brief is reconstructed from local session state.

## Run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` and follow the "Begin" button. The demo token is `demo` — directly visit `/survey/demo/feed` to skip the landing.
```

- [ ] **Step 4: Final commit + push**

```bash
git add README.md
git commit -m "docs(vibewise): rewrite README for MVP hackathon scope" || true
git push -u origin feat/feed-mode
```

Print the GitHub branch URL from the push output.

---

## Definition of done

- [ ] Branch `feat/feed-mode` pushed to GitHub
- [ ] Landing page renders premium dark layout with single CTA
- [ ] `/survey/demo/feed` shows phone-shaped frame on desktop, full-bleed on mobile
- [ ] Heart/X buttons work, with rose pulse on like
- [ ] Progress dots animate as cards scroll
- [ ] End-of-feed screen kicks into `/wrap`
- [ ] `/wrap` accepts optional text
- [ ] `/brief/demo` shows hero image with overlaid headline, like grid, optional quote, recommendations, signoff
- [ ] `pnpm build` green
- [ ] No console errors during happy path

---

## Deviations from the spec (intentional, hackathon scope)

| Spec section | Spec calls for | MVP cuts to | Why |
|---|---|---|---|
| §5.2 Reactions | 5 reaction types incl. dwell-tracked `lingered`/`bounced`/`neutral` | Only `like` + `dislike` from button taps | Half the code; same signal quality for a demo |
| §5.3 Dwell timer | IntersectionObserver tracks 0.75/0.25 thresholds, computes ms | Observer only advances progress dots | Skip the noisy implicit signal |
| §8 Inference | `aggregateProfile` + `engagementLevel` + `topLiked` + `topBounced` + tests | Single `summarize()` function; show likes only | Demo doesn't need the bounce panel |
| §11 Brief | 7 sections including "What they bounced from" + engagement chip | 4 sections: hero, like grid, optional quote, recommendations | Smaller surface, more polished |
| §13 Audio path | Park, don't delete | Delete `/audio` route + webhook entirely | Removes dead links; simplifies |
| Modality fork | `/survey/[token]` page | Skipped; landing goes straight to `/feed` | One less screen between user and the wow moment |
| Test coverage | Vitest suites for all inference functions | None — delete old suite, no replacement | Demo doesn't need them; saves 30 min |

If post-demo you want any of these back, the comprehensive plan at `2026-05-16-vibewise-feedmode-plan.md` is the reference.
