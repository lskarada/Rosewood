import vibes from '@/content/vibes.json';
import type { VibePair } from './types';

export function loadPairs(): VibePair[] {
  return (vibes as { pairs: VibePair[] }).pairs;
}

export function findPair(id: string): VibePair | null {
  return loadPairs().find(p => p.id === id) ?? null;
}
