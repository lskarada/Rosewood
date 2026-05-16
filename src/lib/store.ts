'use client';
import { create } from 'zustand';
import type { SurveyState, VibePair, VibeSide, AnsweredPair } from './types';
import { emptyProfile } from './types';
import { updateProfile, predict, selectNextPair, shouldExit, confidence } from './inference';
import { loadPairs } from './content';

interface Actions {
  init: (token: string, modality: 'audio' | 'visual') => void;
  currentPair: () => VibePair | null;
  answer: (chose: 'a' | 'b', tMs?: number) => void;
  reset: () => void;
}

type Store = SurveyState & { _currentPairId: string | null } & Actions;

export const useSurvey = create<Store>((set, get) => ({
  token: '',
  modality: null,
  profile: emptyProfile(),
  answered: [],
  streak: 0,
  maxStreak: 0,
  exhaustedPairIds: [],
  isComplete: false,
  confidence: 0,
  _currentPairId: null,

  init: (token, modality) => {
    const pool = loadPairs();
    const first = selectNextPair(emptyProfile(), 0, [], pool);
    set({
      token, modality,
      profile: emptyProfile(),
      answered: [], streak: 0, maxStreak: 0,
      exhaustedPairIds: [], isComplete: false, confidence: 0,
      _currentPairId: first?.id ?? null,
    });
  },

  currentPair: () => {
    const id = get()._currentPairId;
    return id ? loadPairs().find(p => p.id === id) ?? null : null;
  },

  answer: (chose, tMs) => {
    const state = get();
    const pool = loadPairs();
    const pair = pool.find(p => p.id === state._currentPairId);
    if (!pair) return;

    const side: VibeSide = chose === 'a' ? pair.a : pair.b;
    const answerIndex = state.answered.length + 1;

    const predicted = state.answered.length >= 3
      ? predict(state.profile, pair)
      : undefined;
    const correct = predicted === undefined ? undefined : predicted === chose;

    const profile = updateProfile(state.profile, side, answerIndex);
    const newAnswered: AnsweredPair[] = [
      ...state.answered,
      { pairId: pair.id, chose, predicted, correct, tMs },
    ];
    const newStreak = correct === false ? 0 : (correct === true ? state.streak + 1 : state.streak);
    const maxStreak = Math.max(state.maxStreak, newStreak);
    const exhausted = [...state.exhaustedPairIds, pair.id];

    const tentative: SurveyState = {
      ...state, profile, answered: newAnswered, streak: newStreak,
      maxStreak, exhaustedPairIds: exhausted,
      confidence: confidence(maxStreak, newAnswered.length),
      isComplete: false,
    };

    const exit = shouldExit(tentative, pool);
    const nextPair = exit ? null : selectNextPair(profile, newStreak, exhausted, pool);

    set({
      profile, answered: newAnswered, streak: newStreak, maxStreak,
      exhaustedPairIds: exhausted,
      confidence: confidence(maxStreak, newAnswered.length),
      isComplete: exit || nextPair === null,
      _currentPairId: nextPair?.id ?? null,
    });
  },

  reset: () => set({
    token: '', modality: null, profile: emptyProfile(), answered: [],
    streak: 0, maxStreak: 0, exhaustedPairIds: [], isComplete: false,
    confidence: 0, _currentPairId: null,
  }),
}));
