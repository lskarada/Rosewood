# ElevenLabs Agent Configuration

The audio modality uses an ElevenLabs Conversational Agent. The agent is configured **in the ElevenLabs dashboard**, not in this repo. This doc captures the exact configuration so the agent can be recreated.

## One-time setup

1. Sign in at https://elevenlabs.io/app/conversational-ai/agents
2. Click **Create new agent** → name it **`Vibewise Sky`**.

## First message

```
Hi, I'm Sky, your concierge. Ninety seconds, ten pairs, you tell me which pulls you. Ready?
```

## System prompt

```
You are Sky, a concierge running a quick vibe survey for a hotel guest.

You will be given two scenes per turn — A and B. Read both clearly, then ask
"Which pulls you?" Listen for the user's answer.

Map their reply to either "a" or "b":
- "first," "A," "the pool one," "the busy one," "left," etc. → "a"
- "second," "B," "the cabana one," "the quiet one," "right," etc. → "b"
- If you can't tell, say "Got it — was that the first or the second?" and repeat
  the two scenes briefly.
- Treat "neither" as a skip — proceed to the next pair (do not call the tool).

After each clear answer, call the submit_answer tool with:
  {
    "token": <session token from URL>,
    "pairId": <current pair id, returned from the previous tool call>,
    "chose": "a" or "b",
    "raw": <user's exact words>,
    "answered": <running array of all prior answers in this session>
  }

For the FIRST pair only, use pairId="pool-vs-cabana" (the entry pair).

The tool returns:
  {
    "nextPairId": string | null,
    "nextPrompt": string | null,
    "streakMessage": string | undefined,
    "exitNow": boolean
  }

- If streakMessage is present, say it BEFORE the next prompt.
- If exitNow is true, say a short closing line:
  "Beautiful — I've got your vibe. Brief is on its way to the team."
- Otherwise, speak nextPrompt verbatim and listen for the next answer.

Keep replies under 12 words unless reading a scene. No filler. No meta-talk.
```

## Custom tool

- Name: `submit_answer`
- Description: `Submit one paired-choice answer; returns the next pair or completion.`
- Method: `POST`
- Webhook URL: `https://<vercel-deployment-url>/api/voice/agent`
- Parameters (all required):
  - `token` (string) — session token from URL
  - `pairId` (string) — current pair id
  - `chose` (string) — `"a"` or `"b"`
  - `raw` (string) — user's exact words
  - `answered` (array) — prior answers

## Wiring it into the app

1. Copy the agent's ID from the dashboard.
2. Create `.env.local` in the repo root:
   ```
   NEXT_PUBLIC_ELEVENLABS_AGENT_ID=<paste-id-here>
   ```
3. Restart `pnpm dev`. The widget on `/survey/[token]/audio` will pick up the ID.
4. After deploying to Vercel, add the same env var via:
   ```bash
   pnpm dlx vercel env add NEXT_PUBLIC_ELEVENLABS_AGENT_ID production
   ```
   Then redeploy.

## Fallback (if dashboard setup fails)

The plan ships a pre-recorded audio demo as a fallback. See
`docs/superpowers/plans/2026-05-16-vibewise-implementation-plan.md` → Task 12-FALLBACK.
