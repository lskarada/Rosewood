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
