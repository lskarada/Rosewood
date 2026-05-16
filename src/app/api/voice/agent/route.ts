import { NextRequest, NextResponse } from 'next/server';
import { loadPairs } from '@/lib/content';
import {
  updateProfile, predict, selectNextPair, shouldExit, confidence,
} from '@/lib/inference';
import { emptyProfile, type AnsweredPair, type ProfileVector, type VibePair } from '@/lib/types';

interface VoiceAnswerPayload {
  token: string;
  answered?: AnsweredPair[];
  pairId: string;
  chose: 'a' | 'b';
  raw?: string;
}

export async function POST(req: NextRequest) {
  let body: VoiceAnswerPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!body.token || !body.pairId || !['a', 'b'].includes(body.chose)) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  const pool = loadPairs();
  const pair = pool.find((p: VibePair) => p.id === body.pairId);
  if (!pair) return NextResponse.json({ error: 'unknown pairId' }, { status: 400 });

  // Replay full history to reconstruct profile and streak (stateless server, revision §3)
  let profile: ProfileVector = emptyProfile();
  let streak = 0;
  let maxStreak = 0;
  const exhausted: string[] = [];
  const newAnswered: AnsweredPair[] = [];

  const replay: AnsweredPair[] = [
    ...(body.answered ?? []),
    { pairId: body.pairId, chose: body.chose },
  ];
  for (let i = 0; i < replay.length; i++) {
    const ans = replay[i];
    const p = pool.find((x: VibePair) => x.id === ans.pairId);
    if (!p) continue;
    const side = ans.chose === 'a' ? p.a : p.b;
    const idx = i + 1;
    const predicted = i >= 3 ? predict(profile, p) : undefined;
    const correct = predicted === undefined ? undefined : predicted === ans.chose;
    profile = updateProfile(profile, side, idx);
    streak = correct === false ? 0 : (correct === true ? streak + 1 : streak);
    maxStreak = Math.max(maxStreak, streak);
    exhausted.push(p.id);
    newAnswered.push({ ...ans, predicted, correct });
  }

  const state = {
    token: body.token, modality: 'audio' as const, profile,
    answered: newAnswered, streak, maxStreak, exhaustedPairIds: exhausted,
    isComplete: false, confidence: confidence(maxStreak, newAnswered.length),
  };

  const exit = shouldExit(state, pool);
  const next = exit ? null : selectNextPair(profile, streak, exhausted, pool);

  let streakMessage: string | undefined;
  if (streak === 3) streakMessage = "Okay, three in a row — getting your vibe.";
  if (streak === 0 && newAnswered[newAnswered.length - 1]?.correct === false) {
    streakMessage = "Huh — didn't see that coming. Let me recalibrate.";
  }

  return NextResponse.json({
    nextPairId: next?.id ?? null,
    nextPrompt: next ? renderAudioPrompt(next) : null,
    streakMessage,
    exitNow: exit || next === null,
    confidence: state.confidence,
    answered: newAnswered,
  });
}

function renderAudioPrompt(p: VibePair): string {
  return `Picture two. A: ${p.a.audioPrompt} Or B: ${p.b.audioPrompt} Which pulls you?`;
}
