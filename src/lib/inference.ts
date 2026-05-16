import {
  AXES, AXIS_GROUPS, type Axis, type AnsweredPair, type GuestBrief,
  type ProfileVector, type SurveyState, type VibePair, type VibeSide,
} from './types';

export function updateProfile(
  prev: ProfileVector,
  chosen: VibeSide,
  answerIndex: number,
): ProfileVector {
  const next: ProfileVector = { ...prev };
  for (const axis of AXES) {
    const w = chosen.weights[axis];
    if (w === undefined) continue;
    const blended = (prev[axis] * (answerIndex - 1) + w) / answerIndex;
    next[axis] = clamp(-1, 1, blended);
  }
  return next;
}

export function predict(profile: ProfileVector, pair: VibePair): 'a' | 'b' {
  const sa = score(profile, pair.a);
  const sb = score(profile, pair.b);
  if (Math.abs(sa - sb) < 1e-6) return Math.random() < 0.5 ? 'a' : 'b';
  return sa > sb ? 'a' : 'b';
}

function score(profile: ProfileVector, side: VibeSide): number {
  let s = 0;
  for (const axis of AXES) {
    const w = side.weights[axis];
    if (w !== undefined) s += profile[axis] * w;
  }
  return s;
}

function coveredGroupsCount(answered: AnsweredPair[], pool: VibePair[]): number {
  const groupSeen = new Set<keyof typeof AXIS_GROUPS>();
  const pairById = new Map(pool.map(p => [p.id, p]));
  for (const ans of answered) {
    const pair = pairById.get(ans.pairId);
    if (!pair) continue;
    for (const axis of pair.axes) {
      for (const [groupName, axes] of Object.entries(AXIS_GROUPS) as Array<[keyof typeof AXIS_GROUPS, readonly Axis[]]>) {
        if (axes.includes(axis)) groupSeen.add(groupName);
      }
    }
  }
  return groupSeen.size;
}

export function shouldExit(state: SurveyState, pool?: VibePair[]): boolean {
  if (state.answered.length < 7) return false;
  if (state.streak < 5) return false;
  if (pool) {
    return coveredGroupsCount(state.answered, pool) >= 3;
  }
  // Test-only fallback: derive coverage from pair-id prefix
  const groupsFromIds = new Set(state.answered.map(a => a.pairId.split('-')[0]));
  return groupsFromIds.size >= 3;
}

export function confidence(maxStreak: number, answeredCount: number): number {
  return clamp(0, 1, 0.5 * (maxStreak / 5) + 0.5 * (answeredCount / 10));
}

export function topAxes(profile: ProfileVector, n: number): Axis[] {
  return [...AXES].sort((x, y) => Math.abs(profile[y]) - Math.abs(profile[x])).slice(0, n);
}

export function selectNextPair(
  profile: ProfileVector,
  streak: number,
  exhausted: string[],
  pool: VibePair[],
): VibePair | null {
  const remaining = pool.filter(p => !exhausted.includes(p.id));
  if (remaining.length === 0) return null;

  const scored = remaining.map(p => {
    const uncertainty = Math.min(...p.axes.map(a => Math.abs(profile[a])));
    return { pair: p, uncertainty };
  });

  if (streak >= 3) {
    return scored.sort((x, y) => x.uncertainty - y.uncertainty)[0].pair;
  }
  return scored.sort((x, y) => y.uncertainty - x.uncertainty)[0].pair;
}

export function renderBrief(state: SurveyState): GuestBrief {
  const top = topAxes(state.profile, 2);
  const labels: Record<Axis, [string, string]> = {
    social:      ['social-energy seeker',    'quiet base'],
    evening:     ['late-night',              'early-evening'],
    activity:    ['high-activity mornings',  'wellness mornings'],
    dining:      ['on-property dining',      'off-property exploration'],
    aesthetic:   ['minimal aesthetic',       'maximalist aesthetic'],
    format:      ['group-format',            'solo-format'],
    environment: ['beachfront',              'forested'],
    chronotype:  ['night-owl',               'early-riser'],
  };
  const human = (a: Axis) => state.profile[a] >= 0 ? labels[a][0] : labels[a][1];

  const oneLine = top.length
    ? `${human(top[0])}, ${human(top[1])} — ${state.confidence < 0.5 ? 'ask in person at check-in' : 'recommend the playbook below'}`
    : 'profile too thin — survey the guest in person';

  const recommendations = [
    { title: `Room: ${human(top[0])} corner`, blurb: `Quiet floor, away from elevators, light scent of ${human(top[1])}.` },
    { title: `Evening: ${human(top[0])} mode`, blurb: `Reservation at our ${human(top[0])}-leaning room.` },
    { title: `Morning: ${human(top[1])} kit`, blurb: `Set up ahead of arrival in the room.` },
  ];

  return {
    token: state.token,
    topAxes: top.map(axis => ({ axis, score: state.profile[axis], label: human(axis) })),
    oneLine,
    recommendations,
    confidence: state.confidence,
    modality: state.modality ?? 'visual',
    answeredCount: state.answered.length,
    maxStreak: state.maxStreak,
  };
}

function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v));
}
