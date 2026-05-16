# Vibewise — Feed-Mode Pivot Design Spec

**Date:** 2026-05-16
**Status:** Approved for plan-writing (v1)
**Supersedes:** `2026-05-16-vibewise-design.md` for the visual-survey flow only. Audio/ElevenLabs path is parked.
**Author flow:** brainstorming → routed via `/router` (lanes: feature, refactor) → karpathy-guidelines applied to assumption surfacing.

---

## 1. Why this exists

The v1 paired-choice flow reads like a Google survey — two cards, "pick one," repeat. Users feel surveyed, not delighted. Hotel guests in particular open a confirmation email expecting nothing and we hit them with a quiz.

The pivot reframes intake as **a thirty-second TikTok scroll**: full-bleed imagery, vertical paging, gentle reactions (like / dislike / no-op), implicit dwell tracking, and a three-question debrief at the end. The output is unchanged in intent — a warm handoff to whoever assigns the room — but the *signal* now comes from how the guest engages with imagery, not from forced binary choices.

Customer = hotel staff / booking assistant. User = guest. Brief is still the deliverable.

---

## 2. Surfaced assumptions (from karpathy-guidelines)

1. **Delight > signal-purity.** We will accept noisier inference in exchange for an interaction that feels like consumption, not work. If the brief's confidence dips, we honestly stamp it ("quick scroll — ask in person").
2. **Non-interaction is signal.** A user who lingers >2.5s without tapping is leaning positive. A user who scrolls past in <0.8s is leaning negative. We use both.
3. **Audio is parked, not killed.** `/api/voice/agent` and `/survey/[token]/audio` stay in the repo; we just stop routing to them. Resurrecting later is a one-line change in the landing CTA.
4. **Mobile-frame on desktop is intentional.** When the page is opened on a laptop, a fixed 390×844 phone-shaped frame is centered on a dark background. This is the cue that says "this isn't a form, this is an app."
5. **No DB.** Reactions stay in token-keyed Zustand state. Brief reconstructs from event log on render.

---

## 3. User-facing flow

```
/                              landing
   ↓
/survey/[token]                modality fork — for now, single CTA into feed
   ↓
/survey/[token]/feed           NEW · vertical feed, mobile-frame on desktop
   ↓  (10 cards scrolled)
/survey/[token]/wrap           NEW · 3 short-answer questions
   ↓
/brief/[token]                 warm handoff (revised renderer)
```

`/survey/[token]/visual` (old paired-choice route) becomes a 308 redirect to `/feed` so any existing demo links keep working for one release.

---

## 4. Mobile-frame layout

### 4.1 Desktop (≥ 768px)
- Page background: `bg-stone-950`.
- Centered phone-shaped container: 390 × 844 px, `rounded-[44px]`, `border border-stone-800`, `shadow-2xl`.
- Inside the frame: feed cards snap-scroll vertically; the frame itself is the viewport.
- No browser scrollbar visible; only the in-frame scroll moves.

### 4.2 Mobile (< 768px)
- Frame decoration drops entirely; cards fill the device viewport.
- Same snap-scroll mechanic.

### 4.3 Single component
A `<MobileFrame>` wrapper applies the conditional decoration. Children render identically in both modes.

```
┌─────────────────────────────────────┐
│  bg-stone-950                       │
│                                     │
│      ┌──────────────────────┐       │
│      │ [full-bleed image]   │       │
│      │                      │       │
│      │ "Rooftop at dusk"    │       │
│      │                      │       │
│      │           ❤️    ✕   │       │
│      │ ●●●○○○○○○○           │       │
│      └──────────────────────┘       │
│                                     │
└─────────────────────────────────────┘
```

---

## 5. Card mechanics

### 5.1 Card anatomy
- Full-bleed image (object-cover, fills frame).
- Bottom-left: small caption with the side's `label` (e.g. "rooftop at dusk").
- Bottom-right: floating heart button (like) + X button (dislike). Both circular, semi-transparent over a gradient scrim.
- Top: 10 progress dots showing position in the deck.
- Scroll-snap forces one card per viewport.

### 5.2 Interactions and resulting `Reaction`
| Interaction | Reaction emitted |
|---|---|
| Heart tap | `like` |
| X tap | `dislike` |
| Card scrolled off after dwell ≥ 2500ms with no button press | `lingered` |
| Card scrolled off after dwell < 800ms with no button press | `bounced` |
| Card scrolled off with 800–2500ms dwell and no press | `neutral` (zero signal, still recorded) |

Tapping a button does NOT auto-advance — user still scrolls. This protects the dwell signal from being polluted by a fast "tap heart, swipe away" reflex.

### 5.3 Dwell timer
- Timer starts on `IntersectionObserver` entry (≥ 75% in view).
- Timer ends on exit (< 25% in view) or on unmount.
- Single timer per card; subsequent re-entries are not recorded (10 cards, one-pass).

---

## 6. Data model

```ts
// Reactions emitted by the feed UI
export type Reaction = 'like' | 'dislike' | 'lingered' | 'bounced' | 'neutral';

// One entry per card the user scrolled past
export interface CardEvent {
  cardId: string;        // <pair-id>-<a|b>
  reaction: Reaction;
  dwellMs: number;
  enteredAt: number;     // epoch ms; for ordering
}

// Free-text answers from the wrap screen
export interface WrapAnswers {
  partySize?: string;
  constraints?: string;
  perfectTrip?: string;
}

// Replaces SurveyState
export interface FeedState {
  token: string;
  deck: string[];        // shuffled cardIds, length 10
  cursor: number;        // 0..deck.length; advances on scroll-past
  events: CardEvent[];
  wrap: WrapAnswers;
  isComplete: boolean;   // true after wrap submitted
}
```

`GuestBrief` from the old spec stays, with these field additions:
```ts
interface GuestBrief {
  // ... existing fields (token, topAxes, oneLine, recommendations, modality, ...)
  liked: Array<{ cardId: string; image: string; label: string }>;     // top 3
  bounced: Array<{ cardId: string; image: string; label: string }>;   // top 2 by negative weight
  inTheirWords: WrapAnswers;
  engagement: 'high' | 'medium' | 'quick';   // replaces confidence numeric
}
```

Numeric `confidence` field stays for backward compatibility, derived from engagement.

---

## 7. Feed deck construction (`src/lib/feed-deck.ts`)

### 7.1 Flatten
`vibes.json` currently has 9 pairs × 2 sides = 18 candidate cards. Each card inherits:
- `cardId` = `<pair-id>-<a|b>`
- `axes` from the parent pair
- `weights` from its side
- `image`, `label`, `audioPrompt` from its side

### 7.2 Shuffle and pick 10
- Stable seed from token (so the same token always sees the same deck — repeatable demos).
- Constraint: no two cards from the same pair adjacent. (Prevents "pool then cabana" feeling A/B-like.)
- If constraint can't be satisfied after 50 reshuffles, accept first valid prefix.

### 7.3 Public signature
```ts
export function buildDeck(token: string, source: VibePair[]): FeedCardRef[];
```

---

## 8. Inference (`src/lib/inference.ts` — rewrite)

### 8.1 Replaces, not extends
Delete: `predict`, `selectNextPair`, `confidence` (numeric), `shouldExit`, streak logic.
Keep: `topAxes`, `renderBrief` (signature unchanged; body rewritten).
Add: `aggregateProfile`, `engagementLevel`, `topLiked`, `topBounced`.

### 8.2 `aggregateProfile`
```ts
const WEIGHT: Record<Reaction, number> = {
  like:     +1.0,
  lingered: +0.4,
  neutral:   0.0,
  bounced:  -0.2,
  dislike:  -1.0,
};

export function aggregateProfile(events: CardEvent[], deck: FeedCardRef[]): ProfileVector {
  const sum = emptyProfile();
  for (const event of events) {
    const card = deck.find(c => c.cardId === event.cardId);
    if (!card) continue;
    const multiplier = WEIGHT[event.reaction];
    for (const [axis, w] of Object.entries(card.weights)) {
      sum[axis as Axis] += w * multiplier;
    }
  }
  // Clamp each axis to [-1, 1]
  return clampProfile(sum);
}
```

No running-mean smoothing — small N (10 cards) doesn't need it. Predictable, debuggable.

### 8.3 `engagementLevel`
```ts
export function engagementLevel(events: CardEvent[]): 'high' | 'medium' | 'quick' {
  const explicit = events.filter(e => e.reaction === 'like' || e.reaction === 'dislike').length;
  if (explicit >= 5) return 'high';
  if (explicit >= 2) return 'medium';
  return 'quick';
}
```

### 8.4 `topLiked` / `topBounced`
Return up to `n` cards sorted by (a) explicit positive/negative > implicit > none, then (b) absolute weight magnitude in top axis.

### 8.5 `renderBrief`
- `topAxes(profile, 3)` — same as v1.
- `oneLine` — template stitched from top-2 axes (unchanged copy).
- `liked` = `topLiked(events, deck, 3)`.
- `bounced` = `topBounced(events, deck, 2)`.
- `inTheirWords` = `state.wrap` verbatim, no transformation.
- `engagement` = `engagementLevel(events)`.
- `recommendations` = same fixed table lookup keyed on top-2 axes.

---

## 9. Store (`src/lib/store.ts` — rewrite)

```ts
interface FeedStore extends FeedState {
  startSession: (token: string, deck: FeedCardRef[]) => void;
  recordEvent: (event: CardEvent) => void;       // dedupes by cardId
  advanceCursor: () => void;
  submitWrap: (answers: WrapAnswers) => void;
}
```

- `recordEvent` is idempotent per cardId (only first event for a given card counts).
- `submitWrap` flips `isComplete = true`.
- Cursor advances on scroll-past, drives the progress-dots component.

---

## 10. Components

### 10.1 New
- `MobileFrame.tsx` — conditional 390×844 wrapper.
- `FeedCard.tsx` — single card (image, label, heart, X, dwell hooks).
- `VibeFeed.tsx` — vertical scroll-snap container, renders 10 `FeedCard`s, manages `IntersectionObserver`, dispatches `CardEvent`s to store.
- `WrapForm.tsx` — three short-answer textareas + submit button.

### 10.2 Rewritten
- `BriefCard.tsx` — new sections per §11.
- `ProfileSidebar.tsx` — repurposed to debug-view (visible only with `?debug=1` query) showing live profile vector while developing.

### 10.3 Deleted from active routing
- `VibePair.tsx`, `StreakBadge.tsx` — remain in repo (audio flow still imports `VibePair`'s type), but unused by feed flow.

---

## 11. Brief rewrite (`/brief/[token]`)

Section order on the brief page:

1. **Header** — guest name (placeholder), engagement chip ("high engagement" / "medium" / "quick scroll").
2. **One-line read** — top-2 axes stitched (unchanged from v1).
3. **What pulled them** — 3 thumbnail grid of `liked` cards with labels underneath. (This is the image spine from the previous Rosewood pivot, now driven by feed data.)
4. **What they bounced from** — 2 small thumbnails of `bounced` cards. Captioned "skip these in the welcome amenity."
5. **In their words** — three blockquotes from `wrap` answers. All three wrap inputs are optional; the submit button on `/wrap` is always enabled. Any empty answer is omitted from this section; if all three are empty the section is hidden entirely.
6. **Recommendations** — 3 mock packages from the rec table (unchanged).
7. **Signoff** — "— Sky, your concierge at Rosewood Sand Hill" (unchanged from previous pivot).

---

## 12. Files to touch — delta

### Create
- `src/components/MobileFrame.tsx`
- `src/components/FeedCard.tsx`
- `src/components/VibeFeed.tsx`
- `src/components/WrapForm.tsx`
- `src/app/survey/[token]/feed/page.tsx`
- `src/app/survey/[token]/wrap/page.tsx`
- `src/lib/feed-deck.ts`
- `src/lib/inference-feed.test.ts`

### Rewrite (substantial body changes, signatures partially preserved)
- `src/lib/inference.ts` — see §8.1
- `src/lib/store.ts` — see §9
- `src/lib/types.ts` — adds `Reaction`, `CardEvent`, `WrapAnswers`, `FeedState`, `FeedCardRef`; extends `GuestBrief`
- `src/components/BriefCard.tsx` — see §11
- `src/app/survey/[token]/page.tsx` — modality fork: single CTA "Start" (audio CTA commented out, easy to revive)

### Edit (small)
- `src/app/survey/[token]/visual/page.tsx` — replace body with `redirect('/survey/' + token + '/feed')`.
- `src/lib/inference.test.ts` — delete predict/streak suites; keep type-shape assertions.

### Park (do not delete)
- `src/app/survey/[token]/audio/page.tsx`
- `src/app/api/voice/agent/route.ts`
- ElevenLabs widget components
- `docs/elevenlabs-agent-config.md`

### Content
- `src/content/vibes.json` — **no changes**. All 18 sides become deck candidates as-is.

---

## 13. Build phases (3-hour budget; phase-wise gated testing per /router tip [2])

### P1 — Skeleton (0:00–0:30)
- Add new types to `types.ts`.
- Implement `feed-deck.ts` (flatten + shuffle).
- Build `MobileFrame.tsx` shell.
- Single static `FeedCard.tsx` rendering one image, no interactions.
- Stub `/feed` and `/wrap` routes.
- Click-through `/feed → /wrap → /brief` lands placeholders.

**Gate:** all routes return 200; mobile frame visible centered on desktop ≥768px; full-bleed on <768px.

### P2 — Reactions + dwell (0:30–1:15)
- Heart and X buttons → dispatch `like`/`dislike` events.
- `IntersectionObserver` dwell timer → dispatch `lingered`/`bounced`/`neutral` on scroll-past.
- `VibeFeed` renders all 10 cards with scroll-snap.
- Store accumulates events idempotently.
- Delete predict/streak/exit suites from `inference.test.ts` in the same commit that removes the predict/streak code, so the test suite stays green throughout P2.
- New `inference-feed.test.ts` covers `aggregateProfile`, `engagementLevel`, `topLiked`, `topBounced`.

**Gate:** scrolling through 10 cards produces a 10-event log; mixed reactions produce a non-zero `topAxes`; `pnpm test` green.

### P3 — Wrap + brief rewrite (1:15–2:00)
- `WrapForm.tsx` with three textareas; submit advances to `/brief`.
- `BriefCard.tsx` rewritten per §11.
- `inference.ts` `renderBrief` updated to populate new brief fields.

**Gate:** full happy path E2E in browser; brief renders all six sections; "In their words" displays wrap text verbatim.

### P4 — Polish (2:00–2:30)
- Bottom-of-card gradient scrim for button legibility.
- Progress dots at top of frame, filled as cursor advances.
- Subtle scale-down on dislike tap (visual confirmation).
- iOS Safari scroll-snap check via Chrome DevTools device emulation.

**Gate:** 30-second screen recording with no jank or layout shift.

### P5 — Branch + commits (2:30–3:00)
- Branch from `main` (current HEAD = `49ce7c8`, Rosewood pivot already landed) into `feat/feed-mode`.
- Hourly squashed commits during build (one per phase landed).
- Push branch; do not merge until user reviews live.

**Gate:** branch pushed, live preview URL works on a phone.

---

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scroll-snap janky on iOS Safari | `scroll-snap-type: y mandatory` + `overscroll-behavior: contain` + `-webkit-overflow-scrolling: touch`. Verify in P3 gate. |
| Dwell thresholds tuned for me, not real users | Constants live at top of `inference.ts`; documented; testable via Vitest fixtures. Accept v1 numbers, revisit after first demo. |
| 10 cards insufficient signal | Engagement chip ("quick scroll") signals this to staff. Honest under-claim is better than fake confidence. |
| Pre-loading 10 full-bleed images blows mobile data | Use `next/image` `priority` only on first two; rest lazy. Rosewood CDN images already optimized. |
| Brief's "What they bounced from" feels harsh | Soften caption to "skip these in the welcome amenity" (already in spec §11). Frame as helpful, not judgmental. |
| Old paired-choice tests fail after rewrite | Delete predict/streak suites in `inference.test.ts`; keep profile-vector type tests; new logic covered by `inference-feed.test.ts`. |
| Audio flow accidentally broken | Both audio files untouched. Add E2E smoke test to load `/survey/<token>/audio` and assert page renders before merge. |

---

## 15. YAGNI — explicit non-goals

- No persistence beyond URL token (Zustand only)
- No real-time staff dashboard
- No analytics SDK; events live in-session only
- No A/B testing of dwell thresholds in this pivot
- No keyboard navigation for feed (document, defer)
- No accessibility audit beyond `alt` text on images
- No infinite scroll (deck is fixed length 10)
- No swipe gestures (vertical scroll is the gesture)
- No audio flow modifications

---

## 16. Definition of done

The pivot ships when:
- [ ] Branch `feat/feed-mode` pushed to GitHub
- [ ] `/survey/<token>/feed` renders mobile-frame on desktop, full-bleed on mobile
- [ ] Scrolling 10 cards with mixed interactions produces an event log of length 10
- [ ] `/wrap` collects three optional short-answer responses
- [ ] `/brief/<token>` renders all six sections from §11
- [ ] Old `/visual` route 308-redirects to `/feed`
- [ ] Audio route still loads (smoke test)
- [ ] `pnpm test` passes
- [ ] `pnpm build` green
- [ ] One screen recording demonstrating happy path on a phone-shaped viewport

---

## 17. Open questions (deferred to implementation plan)

- Caption position — bottom-left on the image, or below the image as a separate band? Decide during P1 from a quick mockup.
- Dislike animation — scale-down only, or scale + red flash? Decide P4.
- Wrap submit button label — "send to my concierge" vs "finish" vs "see what we picked up." Decide P3 from mockup.
