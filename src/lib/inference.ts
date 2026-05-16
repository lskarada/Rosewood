import {
  AXES, AXIS_GROUPS, type Axis, type AnsweredPair, type BriefRecommendation,
  type GuestBrief, type ProfileVector, type SurveyState, type VibePair, type VibeSide,
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

const AXIS_LABELS: Record<Axis, [string, string]> = {
  social:      ['social-energy seeker',    'quiet base'],
  evening:     ['late-night',              'early-evening'],
  activity:    ['high-activity mornings',  'wellness mornings'],
  dining:      ['on-property dining',      'off-property exploration'],
  aesthetic:   ['minimal aesthetic',       'maximalist aesthetic'],
  format:      ['group-format',            'solo-format'],
  environment: ['beachfront',              'forested'],
  chronotype:  ['night-owl',               'early-riser'],
};

// Cue tables: axis pole → one-liner the concierge team can act on.
// Every axis (8) has entries on both poles so top[0] and top[1] always have cues.
const ROOM_CUES: Record<string, string> = {
  'social+':       'Put them in the wing facing the buzz — pool side, energy floor.',
  'social-':       'Top floor, far from the pool and elevators. Privacy first.',
  'evening+':      'Bar-adjacent if you have it. Pre-clear late check-in and a bar tab.',
  'evening-':      'Quiet wing. Heavy drapes. Confirm an early dinner reservation.',
  'activity+':     'Trail map and a chilled water bottle waiting in the room.',
  'activity-':     'Robe and slippers out. Spa booking pre-pencilled, no pressure.',
  'dining+':       'Welcome amenity: a bottle of our chef’s signature wine.',
  'dining-':       'Welcome amenity: a curated map of nearby spots, three names circled.',
  'aesthetic+':    'Minimal welcome — single stem, clean surfaces. Skip the fruit basket.',
  'aesthetic-':    'Layered welcome — local art on the wall, textured linens, books on the shelf.',
  'format+':       'Concierge intro at check-in — they’ll engage. Mention the group offerings.',
  'format-':       'Skip the welcome introduction. Email-only check-in note is fine.',
  'environment+':  'Water-view room if it is available. The view is the welcome.',
  'environment-':  'Tree-line view beats ocean view for this guest. Quiet side.',
  'chronotype+':   'Late check-in pre-cleared. Do not ring the room before 11am.',
  'chronotype-':   'Morning paper outside the door. Coffee station stocked by 6:30am.',
};

const LEAD_CUES: Record<string, string> = {
  'dining+':       'If they ask for dinner, lead with the chef’s table tasting menu.',
  'dining-':       'If they ask for dinner, three off-property names first. Skip the chef’s-table pitch.',
  'format+':       'Float any group activity early — they’ll say yes.',
  'format-':       'No mass-welcome events. Let them set the pace.',
  'chronotype+':   '24-hour room service menu front and center. They’re a night-owl.',
  'chronotype-':   'Coffee at 6am. Continental tray ready by 7.',
};

export function renderBrief(state: SurveyState, pool: VibePair[]): GuestBrief {
  const top = topAxes(state.profile, 2);
  const human = (a: Axis) => state.profile[a] >= 0 ? AXIS_LABELS[a][0] : AXIS_LABELS[a][1];
  const sign = (a: Axis) => state.profile[a] >= 0 ? '+' : '-';
  const pairById = new Map(pool.map(p => [p.id, p]));

  // Spine: top 3 chosen pairs by max |weight| on the chosen side.
  const spineEntries = state.answered
    .map(ans => {
      const pair = pairById.get(ans.pairId);
      if (!pair) return null;
      const chosen = ans.chose === 'a' ? pair.a : pair.b;
      const rejected = ans.chose === 'a' ? pair.b : pair.a;
      const maxW = Math.max(0, ...Object.values(chosen.weights).map(v => Math.abs(v ?? 0)));
      return { label: chosen.label, vs: rejected.label, image: chosen.image, weight: maxW };
    })
    .filter((x): x is { label: string; vs: string; image: string; weight: number } => x !== null)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  // Greeting: prose, grounded in actual choices.
  const parts: string[] = ['Quick read on the survey.'];
  if (top.length >= 2) {
    parts.push(`They’re a ${human(top[0])} type with a strong pull toward ${human(top[1])}.`);
  } else if (top.length === 1) {
    parts.push(`They lean ${human(top[0])}, but the signal is thin.`);
  } else {
    parts.push('Profile didn’t catch enough signal to call cleanly.');
  }
  if (spineEntries.length >= 2) {
    parts.push(
      `Picked the ${spineEntries[0].label} over the ${spineEntries[0].vs}, and the ${spineEntries[1].label} over the ${spineEntries[1].vs} — that’s the spine of who they are this trip.`
    );
  } else if (spineEntries.length === 1) {
    parts.push(`Strongest signal: chose the ${spineEntries[0].label} over the ${spineEntries[0].vs}.`);
  }
  const greeting = parts.join(' ');

  // Surprise: first wrong prediction, told as a colleague would.
  let surprise: string | undefined;
  const missed = state.answered.find(a => a.correct === false);
  if (missed) {
    const pair = pairById.get(missed.pairId);
    if (pair && missed.predicted) {
      const chosen = missed.chose === 'a' ? pair.a : pair.b;
      const predicted = missed.predicted === 'a' ? pair.a : pair.b;
      surprise = `Surprised me on one — they picked the ${chosen.label} when I had them pegged for the ${predicted.label}. Hold that loosely; there’s more to them than the streak suggests.`;
    }
  }

  // Recommendations: pull from cue tables based on top axis poles.
  const recs: BriefRecommendation[] = [];
  if (top[0]) {
    const cue = ROOM_CUES[`${top[0]}${sign(top[0])}`];
    if (cue) recs.push({ title: 'Room', blurb: cue });
  }
  if (top[1]) {
    const cue = ROOM_CUES[`${top[1]}${sign(top[1])}`];
    if (cue) recs.push({ title: 'Pre-arrival touch', blurb: cue });
  }
  // Lead-with: any strong-signal axis with a LEAD_CUES entry that isn't already
  // the same axis as top[0] (avoid repeating ourselves).
  for (const axis of AXES) {
    if (Math.abs(state.profile[axis]) < 0.3) continue;
    if (axis === top[0]) continue;
    const cue = LEAD_CUES[`${axis}${state.profile[axis] >= 0 ? '+' : '-'}`];
    if (cue) {
      recs.push({ title: 'Lead with', blurb: cue });
      break;
    }
  }
  // Honest fallback only when we genuinely don't have enough signal.
  while (recs.length < 3) {
    recs.push({
      title: 'Open question',
      blurb: 'Survey didn’t catch enough signal here — ask at check-in.',
    });
  }

  // Confidence as a phrase the team can act on, not a percentage.
  let confidencePhrase: string;
  if (state.confidence < 0.4) {
    confidencePhrase = 'This is a starter sketch. Fill in the rest at check-in.';
  } else if (state.confidence < 0.7) {
    confidencePhrase = 'I have a working read on them. Use this; adjust as you meet them.';
  } else {
    confidencePhrase = 'Solid read. Move on this with confidence.';
  }

  return {
    token: state.token,
    modality: state.modality ?? 'visual',
    headline: 'Brief from Sky',
    greeting,
    surprise,
    spine: spineEntries.map(s => ({ label: s.label, vs: s.vs, image: s.image })),
    recommendations: recs.slice(0, 3),
    confidencePhrase,
    signoff: '— Sky · your AI concierge',
    topAxes: top.map(axis => ({ axis, score: state.profile[axis], label: human(axis) })),
    confidence: state.confidence,
    answeredCount: state.answered.length,
    maxStreak: state.maxStreak,
  };
}

function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v));
}
