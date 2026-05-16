# Vibewise — Design Spec

**Date:** 2026-05-16
**Status:** Approved for implementation (v4)
**Build target:** 3-hour hackathon, deployable to Vercel
**Author flow:** brainstorming v1 → v2 → v3 → v4, routed via `/router`

---

## 1. Product story

> Hotels send a confirmation email and then disappear until check-in. We replace that dead zone with a 90-second vibe survey delivered by an AI concierge before a booking is finalized. The output is a one-page **guest brief** that gets sent to whoever assigns the room and builds the itinerary — so they stop guessing.

Customer = hotel (or travel agent / OTA). User = guest. The AI concierge is the bridge.

---

## 2. Core mechanic

### 2.1 Paired forced-choice
Each "question" is two side-by-side **vibe shots** — full-bleed images (or spoken descriptions in audio mode). Examples:

| Pair | Side A | Side B | Axis probed |
|---|---|---|---|
| 1 | Busy pool, music, crowd | Hidden cabana, book, water | social-energy |
| 2 | Rooftop DJ at sunset | Fireplace + book at midnight | evening-pace |
| 3 | Trail run at dawn | Spa morning | activity |
| 4 | Hidden local spot | Chef's table on-property | dining-gravity |
| 5 | Minimal concrete loft | Layered maximalist suite | aesthetic |
| 6 | Solo yoga at sunrise | Group cooking class | format |
| 7 | Beachfront sunbathing | Forested ridgeline | environment |
| 8 | Late-night ramen | Farmer's market at 7am | chronotype |

Guest taps (or says) the side that pulls them.

### 2.2 Inference engine — 8-axis profile vector
Each side carries weights on 1–2 axes (range −1 to +1). The guest's running profile is a weighted sum of chosen-side weights, normalized after each answer.

```
Axes: social | evening | activity | dining | aesthetic | format | environment | chronotype
```

### 2.3 Predictive streak — the feedback loop
- **Pairs 1–3:** baseline collection. No predictions yet.
- **Pair 4+:** server predicts which side the guest will pick (dot product of current profile vs. each side's weights).
- **Correct prediction:** `streak++`. Profile gets reinforced.
- **Wrong prediction:** `streak = 0`. Profile re-weights toward the actual choice. Next pair probes the surprised axis.
- **Streak ≥ 5 AND answered ≥ 7 pairs:** survey ends early.
- **Streak length / max streak:** drives the `confidence` score on the final brief.

### 2.4 Modality fork
At survey start, guest picks one of two front-ends. Both feed the same inference engine, both produce the same brief.

| | Visual | Audio |
|---|---|---|
| Front-end | Paired image cards, taps | ElevenLabs Conversational Agent, voice |
| Use case | Couch / waiting room | Driving / hands-busy |
| Streak display | Visible counter + microcopy | Agent narrates streak milestones |
| Time | ~90 seconds | ~75 seconds |

The fork is **explicit**, chosen once at session start. No mid-flow switching.

---

## 3. Architecture

### 3.1 Stack
- **Next.js** (App Router, TypeScript)
- **Tailwind CSS**
- **Zustand** for client state (token-keyed, in-memory)
- **ElevenLabs Conversational Agents** for audio modality
- **Vercel** for deploy
- **No DB, no auth.** Token in URL is the only persistent state. Server reconstructs profile from the answered-array each webhook call (or holds it in a short-lived in-memory map keyed by token — see §6.2 below).

### 3.2 Directory layout
```
Hospitality/
├── .claude/
│   └── settings.local.json
├── docs/superpowers/specs/
│   └── 2026-05-16-vibewise-design.md       # this file
├── public/vibes/                            # pre-generated images
│   └── <pair-id>-<a|b>.png
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                         # landing
│   │   ├── survey/[token]/
│   │   │   ├── page.tsx                     # modality fork
│   │   │   ├── visual/page.tsx              # visual flow
│   │   │   └── audio/page.tsx               # audio flow (ElevenLabs widget)
│   │   ├── brief/[token]/page.tsx           # guest brief
│   │   └── api/voice/agent/route.ts         # ElevenLabs webhook
│   ├── components/
│   │   ├── VibePair.tsx
│   │   ├── StreakBadge.tsx
│   │   ├── ProfileSidebar.tsx
│   │   ├── ModalityFork.tsx
│   │   └── BriefCard.tsx
│   ├── lib/
│   │   ├── inference.ts
│   │   ├── content.ts
│   │   ├── store.ts
│   │   └── elevenlabs.ts
│   └── content/
│       └── vibes.json
├── package.json
└── README.md
```

### 3.3 Data flow

**Visual flow:**
```
Browser (Zustand) ──── selectNextPair ───→ render VibePair
       │
       ├── tap A or B
       │
       └── updateProfile + predict + streak → render next, or → /brief
```

**Audio flow:**
```
Guest voice ─── ElevenLabs Agent ─── POST /api/voice/agent ───→ Server
                                                                    │
                                                                    ├── updateProfile + predict + streak + selectNextPair
                                                                    │
                                                                    └── { nextPrompt, exitNow, streakMessage }
                                                                            │
                                            ElevenLabs Agent ←──────────────┘
                                                  │
                                                  └─→ speaks next prompt (or final brief)
```

---

## 4. Schemas

### 4.1 Content schema — `src/content/vibes.json`
```json
{
  "pairs": [
    {
      "id": "pool-vs-cabana",
      "axes": ["social"],
      "a": {
        "label": "busy pool",
        "image": "/vibes/pool-vs-cabana-a.png",
        "audioPrompt": "A crowded resort pool — music thumping, drinks flying, every chair claimed.",
        "weights": { "social": 0.8 }
      },
      "b": {
        "label": "hidden cabana",
        "image": "/vibes/pool-vs-cabana-b.png",
        "audioPrompt": "A hidden cabana behind palms — one chair, a book, the sound of water.",
        "weights": { "social": -0.8 }
      }
    }
    // ... 11–14 more
  ]
}
```

**Authoring rules:**
- Every pair must declare ≥1 axis in `axes`
- Every side's `weights` must touch ≥1 axis from `axes`
- Audio prompts must be ≤ 15 words (≈ 6 seconds spoken)
- ~6 of the 12 pairs should be **high-signal** (one axis dominates, weight ≥ 0.7) so streaks build fast

### 4.2 Profile vector
```ts
type Axis = 'social' | 'evening' | 'activity' | 'dining'
          | 'aesthetic' | 'format' | 'environment' | 'chronotype';

type ProfileVector = Record<Axis, number>;  // running mean, clamped to [-1, 1]
```

### 4.3 Survey state
```ts
interface AnsweredPair {
  pairId: string;
  chose: 'a' | 'b';
  predicted?: 'a' | 'b';
  correct?: boolean;
  tMs?: number;       // time-to-answer for diagnostics
}

interface SurveyState {
  token: string;
  modality: 'audio' | 'visual' | null;
  profile: ProfileVector;
  answered: AnsweredPair[];
  streak: number;
  maxStreak: number;
  exhaustedPairIds: string[];
  isComplete: boolean;
  confidence: number;   // 0..1, derived (see §5.4)
}
```

### 4.4 Guest brief (output)
```ts
interface GuestBrief {
  token: string;
  topAxes: Array<{ axis: Axis; score: number; label: string }>;
  oneLine: string;                  // rule-based, e.g. "Quiet base, big mornings, late dinners, off-property exploration"
  recommendations: BriefRecommendation[];  // 3 mock packages keyed off top-2 axes
  confidence: number;
  modality: 'audio' | 'visual';
  answeredCount: number;
  maxStreak: number;
}
```

---

## 5. Inference module — `src/lib/inference.ts`

### 5.1 Public signature
```ts
export function updateProfile(prev: ProfileVector, chosen: VibeSide): ProfileVector;
export function predict(profile: ProfileVector, pair: VibePair): 'a' | 'b';
export function selectNextPair(
  profile: ProfileVector,
  streak: number,
  exhausted: string[],
  pool: VibePair[]
): VibePair | null;
export function confidence(maxStreak: number, answeredCount: number): number;
export function shouldExit(answeredCount: number, streak: number): boolean;
export function topAxes(profile: ProfileVector, n: number): Axis[];
export function renderBrief(state: SurveyState): GuestBrief;
```

### 5.2 `updateProfile`
For each axis touched by the chosen side's weights, mix into the running profile with a smoothing factor α = 0.5 on the first 3 answers, then α = 0.35 thereafter (later evidence weighs less so the profile stabilizes).

### 5.3 `predict`
Compute `score_a = profile · weights_a` and `score_b = profile · weights_b`. Return `'a'` if `score_a > score_b`, else `'b'`. Ties → randomized to avoid bias.

### 5.4 `confidence`
```
confidence = clamp(0, 1, 0.5 * (maxStreak / 5) + 0.5 * (answeredCount / 10))
```

A maxStreak of 5 alone gives 0.5. Answering 10 pairs alone gives 0.5. Both maxes out at 1.0. A brief stamped < 0.5 should say "ask the guest in person at check-in."

### 5.5 `selectNextPair`
1. Filter pool by `id ∉ exhausted`
2. For each remaining pair, compute `min(|profile[axis]|)` across the pair's axes — this is the "uncertainty on the axis it probes."
3. If `streak < 3`: pick the pair with **highest uncertainty** (probe new ground)
4. If `streak ≥ 3`: pick the pair with **lowest uncertainty** (extend the streak by asking about something we're confident on)
5. If pool exhausted: return `null` → survey ends.

### 5.6 `shouldExit`
```ts
return answeredCount >= 7 && streak >= 5;
```
Always return false before pair 7 so the brief has enough signal.

### 5.7 `renderBrief`
- `topAxes` = the 2 axes with highest `|profile[axis]|`, returned with human labels (e.g. `social=-0.7` → `"introvert-leaning"`)
- `oneLine` = template stitched from the top-2 axes' labels (no LLM call — keeps the build deterministic and fast)
- `recommendations` = 3 mock packages indexed by `(topAxes[0], topAxes[1])` from a fixed table

---

## 6. ElevenLabs webhook contract — `POST /api/voice/agent`

### 6.1 Request / response
```ts
interface VoiceAnswerPayload {
  token: string;     // session token (also in URL)
  pairId: string;    // which pair was being asked
  chose: 'a' | 'b';  // mapped from free-form speech by the agent itself
  raw: string;       // raw utterance, logged for debugging
}

interface VoiceAnswerResponse {
  nextPairId: string | null;   // null = survey complete, redirect to /brief
  nextPrompt: string | null;   // pre-rendered "A or B?" line the agent speaks next
  streakMessage?: string;      // optional "okay, 3 in a row — getting your vibe"
  exitNow: boolean;            // true when shouldExit() fires
}
```

### 6.2 Server-side session storage
Because there's no DB, the webhook needs to reconstruct or remember state across calls within a session:
- **Option A (chosen):** A short-lived in-memory `Map<token, SurveyState>` on the Next.js server. Survives ~10 minutes (Vercel lambda warm window). Acceptable for demo; not for production.
- **Option B:** Have the agent pass back the full `answered` array on every webhook call. Stateless server, more bytes per call.

We go with **A** for build speed.

### 6.3 Agent system prompt (sketch)
The ElevenLabs agent is configured with:
1. An intro line ("Hi, I'm Sky, your concierge at [Hotel]. 90 seconds — pick the side that pulls you. Ready?")
2. A `submit_answer` tool that posts to `/api/voice/agent` with `{token, pairId, chose}`
3. After tool result: speak `nextPrompt` (the next pair) and `streakMessage` (if present). If `exitNow` is true, say a closing line and end the call.

The agent itself is **dumb**: it doesn't know the axes, the streak math, or the inference. The server is the single source of truth across both modalities.

---

## 7. Build sequence (vertical-slice first)

### Phase 1 — Walking skeleton (0:00–0:45)
1. `pnpm create next-app@latest . --ts --tailwind --app --src-dir --import-alias "@/*"`
2. `pnpm add zustand`
3. Stub all 4 routes with one-line placeholders
4. Hardcode 3 vibe pairs in `vibes.json`
5. Click-through end-to-end: landing → fork → visual → brief renders SOMETHING

**Gate:** all routes return 200, no console errors.

### Phase 2 — Visual flow + inference engine (0:45–1:45)
6. Implement `lib/inference.ts` (all signatures from §5)
7. Wire `VibePair`, `StreakBadge`, `ProfileSidebar`
8. Visual flow produces a real brief

**Gate:** 5 visual taps in a row produce a brief with non-zero confidence; predicted-vs-actual rendering visible in dev.

### Phase 3 — Content (1:45–2:15)
9. Generate/curate remaining 9–12 vibe pairs, fill `vibes.json`

**Gate:** linter check — every pair has ≥1 axis, every side's weights touch a declared axis.

### Phase 4 — Audio flow (2:15–2:45)
10. Build `/api/voice/agent` per §6
11. Configure ElevenLabs agent with system prompt + tool
12. Embed agent widget in `/survey/[token]/audio`

**Gate:** one full audio loop completes end-to-end, the same brief renders as for visual.

### Phase 5 — Polish + ship (2:45–3:00)
13. Hero copy on landing; deploy to Vercel; record 90-second demo

**Gate:** live URL works on a phone.

---

## 8. Demo storyboard (90 seconds)

1. **Hook (10s)** — "Hotels survey guests with 10-field forms. We do it with 7 taps — and the algorithm tells you when it's done learning."
2. **Visual run (25s)** — open `/survey/<token>`, choose 📱, tap through 4–5 pairs. Streak counter ticks. One pair breaks the streak ("interesting — didn't see that coming"). Brief renders, confidence = 73%.
3. **Audio run (25s)** — refresh, choose 🎧. ElevenLabs agent walks through 3 pairs live. Free-form responses ("the quiet one," "second"). Agent narrates streak milestones. Same brief renders.
4. **Brief (15s)** — same brief format from two intakes, both stamped with confidence.
5. **Close (15s)** — "Same brain. Two doors in. The streak is the algorithm. Three hours."

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| ElevenLabs agent unreliable in last 45 min of build | Pre-record one clean 30-second audio run as a video backup. Demo plays the recording if live agent flakes. |
| Free-form answer mapping fails on edge cases ("neither," "both") | Agent system prompt includes a "repeat the choices" fallback branch. Webhook validates `chose ∈ {'a','b'}` and 400s otherwise so the agent re-asks. |
| Adaptive `selectNextPair` eats more time than budgeted | Fallback: random selection from unexhausted pool. The predictive *streak* still works; only the *adaptation* is lost. |
| 15 pairs is hard to curate in 30 minutes | Drop to 12. With early-exit at streak 5, most sessions only see 6–8 anyway. |
| Profile feels noisy on short streaks | Confidence < 0.5 brief tells the hotel to ask in person. This is a feature, not a bug. |
| Image generation API too slow / expensive for live demo | All images pre-generated and committed to `public/vibes/`. Live gen is out of scope. |

---

## 10. Explicit non-goals (YAGNI)

- No auth, no DB, no persistence beyond lambda warm window
- No real hotel PMS integration
- No real booking flow (we improve the brief that *informs* the booking)
- No multi-hotel marketplace
- No mid-survey modality switching
- No live image generation
- No ML model — the 8-axis dot product **is** the algorithm
- No LLM call for the brief summary — rule-based template is enough

---

## 11. Open questions (deferred to implementation plan)

- **Image source:** pre-generate via Imagen/DALL-E API at build time, or curate from Unsplash with thematic relabeling? Decide at start of Phase 3.
- **Hotel name in demo:** placeholder (`Hotel Vibewise`) vs. real (`1 Hotel West Hollywood`, `Ace Hotel DTLA`)? Real makes the demo land harder but risks trademark; placeholder is safe.
- **Agent voice:** ElevenLabs default vs. custom-cloned? Default keeps Phase 4 under 30 minutes.

---

## 12. Definition of done

The hackathon submission is "done" when:
- [ ] Live Vercel URL renders the landing page on mobile
- [ ] Visual flow: 7 taps → brief with confidence score
- [ ] Audio flow: ElevenLabs agent completes one loop → same brief format
- [ ] 90-second demo video recorded
- [ ] README explains the streak-as-algorithm idea in one paragraph
