import type { FeedCardRef, VibePair } from './types';

const DECK_SIZE = 10;

function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function flatten(pool: VibePair[]): FeedCardRef[] {
  const out: FeedCardRef[] = [];
  for (const pair of pool) {
    for (const side of ['a', 'b'] as const) {
      const data = pair[side];
      out.push({
        cardId: `${pair.id}-${side}`,
        pairId: pair.id,
        side,
        axes: pair.axes,
        weights: data.weights,
        image: data.image,
        label: data.label,
      });
    }
  }
  return out;
}

export function buildDeck(token: string, pool: VibePair[]): FeedCardRef[] {
  const all = flatten(pool);
  const rng = mulberry32(hashSeed(token));
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Best-effort no-adjacent-pair pass: swap any same-pair adjacency forward.
  for (let i = 1; i < shuffled.length; i++) {
    if (shuffled[i].pairId === shuffled[i - 1].pairId) {
      for (let j = i + 1; j < shuffled.length; j++) {
        if (shuffled[j].pairId !== shuffled[i - 1].pairId &&
            (j + 1 >= shuffled.length || shuffled[j + 1].pairId !== shuffled[i].pairId)) {
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          break;
        }
      }
    }
  }
  return shuffled.slice(0, DECK_SIZE);
}
