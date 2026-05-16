export const AXES = [
  'social', 'evening', 'activity', 'dining',
  'aesthetic', 'format', 'environment', 'chronotype',
] as const;

export type Axis = typeof AXES[number];
export type ProfileVector = Record<Axis, number>;

export interface VibeSide {
  label: string;
  image: string;
  audioPrompt: string;
  weights: Partial<Record<Axis, number>>;
}

export interface VibePair {
  id: string;
  axes: Axis[];
  a: VibeSide;
  b: VibeSide;
}

export type Reaction = 'like' | 'dislike';

export interface FeedCardRef {
  cardId: string;
  pairId: string;
  side: 'a' | 'b';
  axes: Axis[];
  weights: Partial<Record<Axis, number>>;
  image: string;
  label: string;
}

export interface CardEvent {
  cardId: string;
  reaction: Reaction;
  at: number; // epoch ms
}

export interface FeedState {
  token: string;
  deck: FeedCardRef[];
  cursor: number;
  events: CardEvent[];
  wrapNote: string;
  isComplete: boolean;
}

export interface BriefRecommendation {
  title: string;
  blurb: string;
}

export interface GuestBrief {
  token: string;
  headline: string;
  oneLine: string;
  liked: Array<{ cardId: string; image: string; label: string }>;
  recommendations: BriefRecommendation[];
  wrapNote: string;
  signoff: string;
  reactionsCount: number;
}

export function emptyProfile(): ProfileVector {
  return {
    social: 0, evening: 0, activity: 0, dining: 0,
    aesthetic: 0, format: 0, environment: 0, chronotype: 0,
  };
}
