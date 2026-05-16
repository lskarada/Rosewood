import {
  AXES, type Axis, type BriefRecommendation, type FeedState,
  type GuestBrief, type Reaction, type ReasoningStep,
} from './types';

const REACTION_WEIGHT: Record<Reaction, number> = {
  like:     +1.0,
  lingered: +0.4,
  bounced:  -0.2,
  dislike:  -1.0,
};

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
  dining:      ['off-property exploration',           'on-property dining'],
  aesthetic:   ['minimal and clean',                  'layered and warm'],
  format:      ['solo time',                          'communal moments'],
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
  'dining+':       'Welcome amenity: Menlo Park dining map, three names circled.',
  'dining-':       'Welcome amenity: bottle of the Madera-pairing red.',
  'aesthetic+':    'Premier Vineyard room — clean palette, single orchid. Skip the fruit basket.',
  'aesthetic-':    'Luxury Suite — layered linens, leather-bound books, deeper wood.',
  'format+':       'No welcome reception. Email-only intro, room set up quietly.',
  'format-':       'Mention the Wine Garden Sunday tasting at check-in.',
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

function fmtSeconds(ms: number): string {
  const s = ms / 1000;
  if (s < 1) return `${Math.round(ms)}ms`;
  return `${s.toFixed(1)}s`;
}

function interpretEvent(
  reaction: Reaction,
  dwellMs: number,
  axes: Axis[],
  pole: '+' | '-',
): string {
  const axisLabel = axes[0] ?? 'this';
  const direction = pole === '+' ? 'positive' : 'inverse';
  switch (reaction) {
    case 'like':
      return `Tapped heart after ${fmtSeconds(dwellMs)} — strong ${direction} signal on ${axisLabel}.`;
    case 'dislike':
      return `Dismissed in ${fmtSeconds(dwellMs)} — strong ${pole === '+' ? 'inverse' : 'positive'} signal on ${axisLabel}.`;
    case 'lingered':
      return `Stayed ${fmtSeconds(dwellMs)} without tapping — implicit ${direction} signal on ${axisLabel}.`;
    case 'bounced':
      return `Scrolled past in ${fmtSeconds(dwellMs)} — weak ${pole === '+' ? 'inverse' : 'positive'} signal on ${axisLabel}.`;
  }
}

export function summarize(state: FeedState): GuestBrief {
  const profile = aggregateProfile(state);
  const top = topAxes(profile, 2);
  const sign = (a: Axis) => profile[a] >= 0 ? '+' : '-';
  const phrase = (a: Axis) =>
    profile[a] >= 0 ? AXIS_PHRASE[a][0] : AXIS_PHRASE[a][1];

  const byId = new Map(state.deck.map(c => [c.cardId, c]));

  // Liked cards for the hero/grid
  const liked = state.events
    .filter(e => e.reaction === 'like')
    .map(e => byId.get(e.cardId))
    .filter((c): c is NonNullable<typeof c> => c !== undefined)
    .slice(0, 3)
    .map(card => ({ cardId: card.cardId, image: card.image, label: card.label }));

  // Reasoning trail — show ALL events sorted by signal strength
  const eventStrength = (r: Reaction): number =>
    r === 'like' || r === 'dislike' ? 2 : r === 'lingered' ? 1 : 0.3;

  const reasoning: ReasoningStep[] = state.events
    .map(e => {
      const card = byId.get(e.cardId);
      if (!card) return null;
      return {
        cardId: e.cardId,
        image: card.image,
        label: card.label,
        reaction: e.reaction,
        dwellMs: e.dwellMs,
        interpretation: interpretEvent(
          e.reaction,
          e.dwellMs,
          card.axes,
          (card.weights[card.axes[0]] ?? 0) >= 0 ? '+' : '-',
        ),
      };
    })
    .filter((x): x is ReasoningStep => x !== null)
    .sort((a, b) => eventStrength(b.reaction) - eventStrength(a.reaction))
    .slice(0, 6);

  // One-line read
  let oneLine: string;
  if (top.length === 0) {
    oneLine = 'Light signal from the scroll — treat this as a starter sketch.';
  } else if (top.length === 1) {
    oneLine = `Reading them as ${phrase(top[0])}.`;
  } else {
    oneLine = `Reading them as ${phrase(top[0])}, with a real pull toward being ${phrase(top[1])}.`;
  }

  // Recommendations
  const recs: BriefRecommendation[] = [];
  if (top[0]) {
    const cue = ROOM_CUES[`${top[0]}${sign(top[0])}`];
    if (cue) recs.push({ title: 'Set the room', blurb: cue });
  }
  if (top[1]) {
    const cue = ROOM_CUES[`${top[1]}${sign(top[1])}`];
    if (cue) recs.push({ title: 'Pre-arrival touch', blurb: cue });
  }
  // Third rec: pull from a strong non-top axis if there is one
  for (const axis of AXES) {
    if (recs.length >= 3) break;
    if (top.includes(axis)) continue;
    if (Math.abs(profile[axis]) < 0.3) continue;
    const cue = ROOM_CUES[`${axis}${profile[axis] >= 0 ? '+' : '-'}`];
    if (cue) recs.push({ title: 'Also worth noting', blurb: cue });
  }
  while (recs.length < 2) {
    recs.push({
      title: 'Open question',
      blurb: 'Not enough signal yet — ask them at check-in.',
    });
  }

  // Axis scores for the analytics readout
  const axisScores = top.map(axis => ({
    axis,
    score: Math.round(profile[axis] * 100) / 100,
    phrase: phrase(axis),
  }));

  // Confidence from total explicit reactions + signal magnitude
  const explicit = state.events.filter(e => e.reaction === 'like' || e.reaction === 'dislike').length;
  const totalAbsScore = AXES.reduce((s, a) => s + Math.abs(profile[a]), 0);
  let confidence: 'high' | 'medium' | 'low';
  if (explicit >= 5 || totalAbsScore >= 2.0) confidence = 'high';
  else if (explicit >= 2 || totalAbsScore >= 0.8) confidence = 'medium';
  else confidence = 'low';

  const totalDwellMs = state.events.reduce((s, e) => s + e.dwellMs, 0);

  return {
    token: state.token,
    headline: 'Pre-arrival brief — Rosewood Sand Hill',
    oneLine,
    liked,
    recommendations: recs,
    reasoning,
    axisScores,
    wrapNote: state.wrapNote,
    signoff: 'Sky · your AI concierge at Sand Hill',
    reactionsCount: state.events.length,
    totalDwellMs,
    confidence,
  };
}
