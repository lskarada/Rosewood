'use client';
import { create } from 'zustand';
import type { FeedState, FeedCardRef, CardEvent, Reaction } from './types';

interface Actions {
  startSession: (token: string, deck: FeedCardRef[]) => void;
  recordEvent: (cardId: string, reaction: Reaction, dwellMs: number) => void;
  advanceCursor: () => void;
  setWrapNote: (note: string) => void;
  complete: () => void;
  reset: () => void;
}

type Store = FeedState & Actions;

const EMPTY: FeedState = {
  token: '',
  deck: [],
  cursor: 0,
  events: [],
  wrapNote: '',
  isComplete: false,
};

export const useFeed = create<Store>((set, get) => ({
  ...EMPTY,

  startSession: (token, deck) => set({ ...EMPTY, token, deck }),

  recordEvent: (cardId, reaction, dwellMs) => {
    const state = get();
    const filtered = state.events.filter(e => e.cardId !== cardId);
    const event: CardEvent = { cardId, reaction, dwellMs, at: Date.now() };
    set({ events: [...filtered, event] });
  },

  advanceCursor: () => {
    const state = get();
    if (state.cursor < state.deck.length) set({ cursor: state.cursor + 1 });
  },

  setWrapNote: (note) => set({ wrapNote: note }),
  complete: () => set({ isComplete: true }),
  reset: () => set(EMPTY),
}));
