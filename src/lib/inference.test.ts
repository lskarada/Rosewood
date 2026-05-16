import { describe, it, expect } from 'vitest';
import {
  updateProfile, predict, confidence,
  shouldExit, topAxes, renderBrief,
} from './inference';
import { emptyProfile, type VibePair, type SurveyState, type AnsweredPair } from './types';

const poolCabana: VibePair = {
  id: 'pool-vs-cabana', axes: ['social'],
  a: { label: 'pool', image: '', audioPrompt: '', weights: { social: 0.8 } },
  b: { label: 'cabana', image: '', audioPrompt: '', weights: { social: -0.8 } },
};

describe('updateProfile (running mean)', () => {
  it('moves profile toward chosen side weights', () => {
    const p = updateProfile(emptyProfile(), poolCabana.a, 1);
    expect(p.social).toBeGreaterThan(0);
  });

  it('plain mean: second answer averages with first', () => {
    let p = updateProfile(emptyProfile(), poolCabana.a, 1);
    p = updateProfile(p, poolCabana.b, 2);
    expect(Math.abs(p.social)).toBeLessThan(0.5);
  });
});

describe('predict', () => {
  it('predicts the side aligned with current profile', () => {
    const p = { ...emptyProfile(), social: 0.7 };
    expect(predict(p, poolCabana)).toBe('a');
  });

  it('random fallback on zero profile (no NaN, valid side)', () => {
    const p = emptyProfile();
    const out = predict(p, poolCabana);
    expect(['a', 'b']).toContain(out);
  });
});

describe('confidence', () => {
  it('zero at no answers, no streak', () => {
    expect(confidence(0, 0)).toBe(0);
  });

  it('clamps at 1', () => {
    expect(confidence(10, 20)).toBe(1);
  });

  it('half from streak alone', () => {
    expect(confidence(5, 0)).toBeCloseTo(0.5, 2);
  });
});

describe('shouldExit (coverage-gated)', () => {
  it('false before pair 7', () => {
    const state = mkState({ answered: 6, streak: 5, coveredGroups: 3 });
    expect(shouldExit(state)).toBe(false);
  });

  it('false if streak < 5', () => {
    const state = mkState({ answered: 8, streak: 4, coveredGroups: 3 });
    expect(shouldExit(state)).toBe(false);
  });

  it('false if any axis group has no answers (revision §2)', () => {
    const state = mkState({ answered: 8, streak: 5, coveredGroups: 2 });
    expect(shouldExit(state)).toBe(false);
  });

  it('true when all three axis groups covered, streak >= 5, answered >= 7', () => {
    const state = mkState({ answered: 7, streak: 5, coveredGroups: 3 });
    expect(shouldExit(state)).toBe(true);
  });
});

describe('topAxes', () => {
  it('returns axes ordered by absolute magnitude', () => {
    const p = { ...emptyProfile(), social: -0.6, activity: 0.9, dining: 0.3 };
    expect(topAxes(p, 2)).toEqual(['activity', 'social']);
  });
});

describe('renderBrief', () => {
  it('produces a warm brief with greeting, recommendations, signoff', () => {
    const p = { ...emptyProfile(), social: -0.7, activity: 0.8 };
    const state: SurveyState = {
      token: 't', modality: 'visual', profile: p, answered: [],
      streak: 5, maxStreak: 5, exhaustedPairIds: [], isComplete: true, confidence: 0.85,
    };
    const brief = renderBrief(state, []);
    expect(brief.headline).toBe('Brief from Sky');
    expect(brief.greeting).toMatch(/Quick read/);
    expect(brief.recommendations).toHaveLength(3);
    expect(brief.signoff).toMatch(/Sky/);
    expect(brief.confidence).toBe(0.85);
    // High confidence path => "Solid read" phrase
    expect(brief.confidencePhrase).toMatch(/Solid read/);
  });

  it('quotes actual chosen-vs-rejected labels in the greeting (spine)', () => {
    const pair: VibePair = {
      id: 'pool-vs-cabana', axes: ['social'],
      a: { label: 'busy pool', image: '', audioPrompt: '', weights: { social: 0.8 } },
      b: { label: 'hidden cabana', image: '', audioPrompt: '', weights: { social: -0.8 } },
    };
    const state: SurveyState = {
      token: 't', modality: 'visual',
      profile: { ...emptyProfile(), social: -0.8 },
      answered: [{ pairId: 'pool-vs-cabana', chose: 'b' }],
      streak: 1, maxStreak: 1, exhaustedPairIds: ['pool-vs-cabana'],
      isComplete: true, confidence: 0.5,
    };
    const brief = renderBrief(state, [pair]);
    expect(brief.spine).toEqual([{ label: 'hidden cabana', vs: 'busy pool', image: '' }]);
    expect(brief.greeting).toMatch(/hidden cabana/);
  });

  it('emits a surprise line when a prediction was wrong', () => {
    const pair: VibePair = {
      id: 'rooftop-vs-fireplace', axes: ['evening'],
      a: { label: 'rooftop DJ', image: '', audioPrompt: '', weights: { evening: 0.8 } },
      b: { label: 'fireplace', image: '', audioPrompt: '', weights: { evening: -0.8 } },
    };
    const state: SurveyState = {
      token: 't', modality: 'visual',
      profile: { ...emptyProfile(), evening: 0.5 },
      answered: [{ pairId: 'rooftop-vs-fireplace', chose: 'b', predicted: 'a', correct: false }],
      streak: 0, maxStreak: 1, exhaustedPairIds: ['rooftop-vs-fireplace'],
      isComplete: true, confidence: 0.3,
    };
    const brief = renderBrief(state, [pair]);
    expect(brief.surprise).toMatch(/Surprised me/);
    expect(brief.surprise).toMatch(/fireplace/);
    expect(brief.surprise).toMatch(/rooftop DJ/);
  });
});

function mkState(opts: { answered: number; streak: number; coveredGroups: number }): SurveyState {
  const groupPairs = [
    { id: 'g1', axis: 'social' as const },
    { id: 'g2', axis: 'activity' as const },
    { id: 'g3', axis: 'dining' as const },
  ];
  const answered: AnsweredPair[] = [];
  for (let i = 0; i < opts.answered; i++) {
    const g = groupPairs[Math.min(i, opts.coveredGroups - 1)];
    answered.push({ pairId: `${g.id}-${i}`, chose: 'a' });
  }
  return {
    token: 't', modality: 'visual', profile: emptyProfile(), answered,
    streak: opts.streak, maxStreak: opts.streak, exhaustedPairIds: [],
    isComplete: false, confidence: 0,
  };
}
